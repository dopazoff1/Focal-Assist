import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, HostListener, Inject, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, finalize, forkJoin, map, of, switchMap, timeout } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../services/auth';
import { ChatChannel, ChatConversation, ChatMessage, ChatWidgetConfig, CrmCase, CrmQueueGroup, CrmService, GmailThreadAttachment, GmailThreadMessage, GmailThreadResponse, InternalNoteSaveResponse, MyPlaylistResponse, QaEvaluation } from '../../services/crm';
import { CaseTagEdge, CaseTagNode, CaseTagsService } from '../../services/case-tags';
import { getActiveLocale } from '../../utils/locale';

type CrmChoice = 'my-playlist' | 'my-cases' | 'open-cases' | 'all-cases' | 'my-chats';
type ComposerTarget = 'playlist' | 'my-case' | 'open';
type ComposerMode = 'email' | 'internal';
type ToastType = 'info' | 'error';
type ThreadScrollTarget = ComposerTarget | 'all';

interface CrmToast {
  id: number;
  type: ToastType;
  text: string;
  action?: 'gmail-oauth';
}

interface CaseTagTreeNode {
  id: number;
  label: string;
  content: string;
  children: CaseTagTreeNode[];
}

@Component({
  selector: 'app-crm',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crm.html',
  styleUrls: ['./crm.css']
})
export class Crm implements OnInit, OnDestroy, AfterViewChecked {
  selectedChoice: CrmChoice = 'my-playlist';
  userId = 0;
  userEmail = '';
  loading = false;
  submitting = false;
  syncing = false;
  threadLoading = false;
  private _errorMessage = '';
  private _infoMessage = '';
  toasts: CrmToast[] = [];
  private nextToastId = 1;
  private toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

  myPlaylist: MyPlaylistResponse = { oldestCase: null, cases: [] };
  openCaseQueues: CrmQueueGroup[] = [];
  myCases: CrmCase[] = [];
  allCases: CrmCase[] = [];
  selectedMyCase: CrmCase | null = null;
  selectedOpenCase: CrmCase | null = null;
  selectedAllCaseId: number | null = null;
  allCaseEvaluations: QaEvaluation[] = [];
  evaluationsLoading = false;
  evaluationsError = '';

  qaScore = 85;
  qaStrengths = '';
  qaImprovements = '';
  qaComment = '';
  qaSubmitting = false;

  playlistStatus = 'resolved';
  openCaseStatus = 'pending';
  myCaseStatus = 'pending';
  playlistComposerMode: ComposerMode = 'email';
  myCaseComposerMode: ComposerMode = 'email';
  openCaseComposerMode: ComposerMode = 'email';
  playlistThread: GmailThreadResponse | null = null;
  myCaseThread: GmailThreadResponse | null = null;
  openCaseThread: GmailThreadResponse | null = null;
  allCaseThread: GmailThreadResponse | null = null;
  tagTree: CaseTagTreeNode[] = [];
  tagTreeLoaded = false;
  tagTreeError = '';
  private tagSelectionByCase = new Map<number, Set<number>>();
  private caseTagNodeLookup = new Map<number, CaseTagNode>();
  private tagTreeNodeById = new Map<number, CaseTagTreeNode>();
  private tagParentById = new Map<number, number | null>();
  activeTagPickerCaseId: number | null = null;
  activeTagPickerPath: number[] = [];
  tagPickerHint = '';
  allCaseThreadLoading = false;
  deepLinkTicketId: number | null = null;
  routeTicketRaw: string | null = null;
  routeTicketId: number | null = null;
  private routeSub?: Subscription;
  private loadingGuardTimer: ReturnType<typeof setTimeout> | null = null;
  private allCasesAutoSyncTimer: ReturnType<typeof setInterval> | null = null;
  @ViewChild('playlistEditor') playlistEditor?: ElementRef<HTMLElement>;
  @ViewChild('myCaseEditor') myCaseEditor?: ElementRef<HTMLElement>;
  @ViewChild('openEditor') openEditor?: ElementRef<HTMLElement>;
  @ViewChild('playlistThreadList') playlistThreadList?: ElementRef<HTMLElement>;
  @ViewChild('myCaseThreadList') myCaseThreadList?: ElementRef<HTMLElement>;
  @ViewChild('openThreadList') openThreadList?: ElementRef<HTMLElement>;
  @ViewChild('allCaseThreadList') allCaseThreadList?: ElementRef<HTMLElement>;
  chatChannels: ChatChannel[] = [];
  chatThreads: ChatConversation[] = [];
  selectedChatThreadId: number | null = null;
  chatMessagesByThread = new Map<number, ChatMessage[]>();
  chatLoading = false;
  chatSearch = '';
  newChatReply = '';
  chatWidgetWebsiteName = 'My Website';
  chatWidgetEnabled = false;
  chatWidgetToken = '';
  chatWidgetSnippet = '';
  chatWidgetSaving = false;

  @ViewChild('playlistImageInput') playlistImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('myCaseImageInput') myCaseImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('openImageInput') openImageInput?: ElementRef<HTMLInputElement>;

  activeImage: HTMLImageElement | null = null;
  activeImageTarget: ComposerTarget | null = null;
  activeImageWidthLabel = '';
  private imageResizeActive = false;
  private imageResizeStartX = 0;
  private imageResizeStartWidth = 0;

  attachmentViewerOpen = false;
  activeAttachment: GmailThreadAttachment | null = null;
  activeAttachmentSafeUrl: SafeResourceUrl | null = null;
  private attachmentBodyOverflowBefore = '';

  private pendingThreadScroll: { target: ThreadScrollTarget; force: boolean; behavior: ScrollBehavior } | null = null;

  constructor(
    private crmService: CrmService,
    private caseTagsService: CaseTagsService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    const storedId = isPlatformBrowser(this.platformId) ? Number(localStorage.getItem('id') || 0) : 0;
    const storedEmail = isPlatformBrowser(this.platformId) ? (localStorage.getItem('email') || '') : '';
    this.userId = user?.id ?? storedId;
    this.userEmail = (user?.email || storedEmail || '').toLowerCase().trim();
    this.loadCaseTagTree();
    this.routeSub = this.route.paramMap.subscribe(params => {
      const rawTicket = params.get('ticketId');
      this.routeTicketRaw = rawTicket;
      const parsed = Number(rawTicket || 0);
      this.routeTicketId = rawTicket && Number.isFinite(parsed) && parsed > 0 ? parsed : null;

      const queryTicket = Number(this.route.snapshot.queryParamMap.get('ticket') || 0);
      const nextTicket = this.routeTicketId ?? (queryTicket > 0 ? queryTicket : null);
      const tab = this.route.snapshot.queryParamMap.get('tab');

      this.deepLinkTicketId = nextTicket;
      this.selectedChoice = nextTicket
        ? 'all-cases'
        : (tab === 'my-cases' || tab === 'open-cases' || tab === 'all-cases' || tab === 'my-chats' ? tab : 'my-playlist');

      if (rawTicket && !this.routeTicketId) {
        this.errorMessage = `Invalid ticket id: "${rawTicket}"`;
      }

      this.loadSelectedChoice();
    });
  }

  ngAfterViewChecked(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.pendingThreadScroll) {
      return;
    }

    const { target, force, behavior } = this.pendingThreadScroll;
    const el = this.getThreadListElement(target);
    if (!el) {
      return; // wait until the thread list exists in the DOM
    }

    // If the agent manually scrolled up, don't keep yanking the view down unless forced.
    if (!force && !this.isNearBottom(el)) {
      this.pendingThreadScroll = null;
      return;
    }

    this.pendingThreadScroll = null;
    try {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  }

  get role(): string {
    return this.authService.getNormalizedRole();
  }

  get canCreateQaEvaluation(): boolean {
    return ['QA', 'ADMIN', 'HEAD_CS'].includes(this.role);
  }

  get canSeeQaEvaluations(): boolean {
    return ['QA', 'ADMIN', 'HEAD_CS', 'TEAM_LEADER', 'AGENT'].includes(this.role);
  }

  get selectedAllCase(): CrmCase | null {
    if (!this.selectedAllCaseId) return null;
    return this.allCases.find(c => c.id === this.selectedAllCaseId) ?? null;
  }

  get selectedChatThread(): ChatConversation | null {
    if (!this.selectedChatThreadId) return null;
    return this.chatThreads.find(t => t.id === this.selectedChatThreadId) ?? null;
  }

  ngOnDestroy(): void {
    this.stopAllCasesAutoSync();
    this.routeSub?.unsubscribe();
    for (const timer of this.toastTimers.values()) {
      clearTimeout(timer);
    }
    this.toastTimers.clear();
  }

  get isTicketRoute(): boolean {
    return !!this.routeTicketRaw;
  }

  get errorMessage(): string {
    return this._errorMessage;
  }

  set errorMessage(value: string) {
    this._errorMessage = value;
    if (value?.trim()) {
      this.pushToast('error', value);
    }
  }

  get infoMessage(): string {
    return this._infoMessage;
  }

  set infoMessage(value: string) {
    this._infoMessage = value;
    if (value?.trim()) {
      this.pushToast('info', value);
    }
  }

  dismissToast(toastId: number): void {
    this.toasts = this.toasts.filter(t => t.id !== toastId);
    const timer = this.toastTimers.get(toastId);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(toastId);
    }
  }

  private pushToast(type: ToastType, text: string, action?: CrmToast['action']): void {
    const toast: CrmToast = {
      id: this.nextToastId++,
      type,
      text,
      action
    };
    this.toasts = [...this.toasts, toast];
    const timer = setTimeout(() => this.dismissToast(toast.id), 5000);
    this.toastTimers.set(toast.id, timer);
  }

  handleToastAction(toast: CrmToast): void {
    if (toast.action === 'gmail-oauth') {
      this.startGmailOAuth();
      return;
    }
  }

  private startGmailOAuth(): void {
    if (!this.userId) {
      this.errorMessage = 'No user session found. Please sign in again.';
      return;
    }
    this.crmService.getGmailOAuthUrl(this.userId)
      .pipe(timeout(8000))
      .subscribe({
        next: ({ url }) => {
          if (typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          this._infoMessage = 'Complete Gmail authorization in the opened window, then Sync Inbox.';
          this.pushToast('info', this._infoMessage);
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  selectChoice(choice: CrmChoice): void {
    if (choice === this.selectedChoice && !this.loading && !this.deepLinkTicketId) {
      return;
    }
    this.closeAttachmentViewer();
    this.selectedChoice = choice;
    this.deepLinkTicketId = null;
    this.loadSelectedChoice();
    this.router.navigate(['/crm'], { queryParams: { tab: choice }, replaceUrl: true });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.attachmentViewerOpen) {
      this.closeAttachmentViewer();
    }
  }

  openAttachment(att: GmailThreadAttachment, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const url = (att?.downloadUrl || '').trim();
    if (!url) {
      return;
    }

    this.activeAttachment = att;
    this.attachmentViewerOpen = true;
    const kind = this.attachmentKind(att);
    this.activeAttachmentSafeUrl = (kind === 'pdf' && this.isAllowedAttachmentUrl(url))
      ? this.sanitizer.bypassSecurityTrustResourceUrl(url)
      : null;

    if (isPlatformBrowser(this.platformId) && typeof document !== 'undefined') {
      this.attachmentBodyOverflowBefore = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';
    }
  }

  closeAttachmentViewer(): void {
    this.attachmentViewerOpen = false;
    this.activeAttachment = null;
    this.activeAttachmentSafeUrl = null;

    if (isPlatformBrowser(this.platformId) && typeof document !== 'undefined') {
      document.body.style.overflow = this.attachmentBodyOverflowBefore;
    }
  }

  async downloadActiveAttachment(): Promise<void> {
    const att = this.activeAttachment;
    if (!att?.downloadUrl || !isPlatformBrowser(this.platformId) || typeof document === 'undefined') {
      return;
    }

    try {
      const res = await fetch(att.downloadUrl, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = (att.filename || 'attachment').trim() || 'attachment';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
    } catch (_) {
      // Fallback: let the browser handle it (may open a new tab depending on disposition).
      window.open(att.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }

  private isAllowedAttachmentUrl(rawUrl: string): boolean {
    const value = (rawUrl || '').trim();
    if (!value) return false;

    // Allow relative links served by the API.
    if (value.startsWith('/api/gmail/attachment/')) {
      return true;
    }

    try {
      const u = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return u.pathname.startsWith('/api/gmail/attachment/');
    } catch {
      return false;
    }
  }

  selectOpenCase(item: CrmCase): void {
    this.selectedOpenCase = item;
    this.syncTagSelectionFromCase(item);
    this.openCaseStatus = item.status || 'pending';
    this.clearEditor('open');
    this.loadOpenCaseThread();
  }

  selectMyCase(item: CrmCase): void {
    this.selectedMyCase = item;
    this.syncTagSelectionFromCase(item);
    this.myCaseStatus = item.status || 'pending';
    this.clearEditor('my-case');
    this.loadMyCaseThread();
  }

  selectPlaylistCase(item: CrmCase): void {
    this.myPlaylist = {
      ...this.myPlaylist,
      oldestCase: item
    };
    this.syncTagSelectionFromCase(item);
    this.playlistStatus = item.status || 'resolved';
    this.clearEditor('playlist');
    this.loadPlaylistThread();
  }

  setComposerMode(target: ComposerTarget, mode: ComposerMode): void {
    if (target === 'playlist') {
      this.playlistComposerMode = mode;
      return;
    }
    if (target === 'my-case') {
      this.myCaseComposerMode = mode;
      return;
    }
    this.openCaseComposerMode = mode;
  }

  getTagLabelsForCase(caseItem: CrmCase | null | undefined): string[] {
    if (!caseItem) {
      return [];
    }
    const selectedIds = this.getSelectedTagIdsForCase(caseItem.id);
    const effectiveIds = selectedIds.length
      ? selectedIds
      : (Array.isArray(caseItem.tagNodeIds) ? caseItem.tagNodeIds : []);
    if (effectiveIds.length > 0) {
      return effectiveIds
        .map(id => this.getTagPathLabel(id))
        .filter(label => !!label);
    }
    return Array.isArray(caseItem.tags) ? caseItem.tags : [];
  }

  getTagPillsForCase(caseItem: CrmCase | null | undefined): Array<{ id: number; label: string; tooltip: string }> {
    if (!caseItem) {
      return [];
    }
    const selectedIds = this.getSelectedTagIdsForCase(caseItem.id);
    const effectiveIds = selectedIds.length
      ? selectedIds
      : (Array.isArray(caseItem.tagNodeIds) ? caseItem.tagNodeIds : []);
    if (effectiveIds.length > 0) {
      return effectiveIds.map(id => ({
        id,
        label: this.getTagLeafLabel(id),
        tooltip: this.getTagPathLabel(id)
      }));
    }
    const legacy = Array.isArray(caseItem.tags) ? caseItem.tags : [];
    return legacy.map((label, idx) => ({
      id: -(idx + 1),
      label,
      tooltip: label
    }));
  }

  isTagSelectedForCase(caseId: number | null | undefined, tagNodeId: number): boolean {
    if (!caseId) {
      return false;
    }
    return this.getTagSetForCase(caseId).has(tagNodeId);
  }

  toggleCaseTagSelection(caseId: number | null | undefined, tagNodeId: number, checked: boolean): void {
    if (!caseId) {
      return;
    }
    const selected = this.getTagSetForCase(caseId);
    if (checked) {
      selected.add(tagNodeId);
    } else {
      selected.delete(tagNodeId);
    }
    this.tagSelectionByCase.set(caseId, selected);
  }

  openCaseTagPicker(caseId: number): void {
    this.activeTagPickerCaseId = caseId;
    this.tagPickerHint = '';

    // UX: start on Subcategories by auto-entering a root Category when possible.
    const selected = this.getSelectedTagIdsForCase(caseId)[0] ?? null;
    const rootFromSelection = selected ? this.getRootTagId(selected) : null;
    const preferredRoot = rootFromSelection ?? this.pickDefaultRootTagId();
    const preferredRootNode = preferredRoot != null ? this.tagTreeNodeById.get(preferredRoot) : null;
    const canEnterRoot = preferredRoot != null && (preferredRootNode?.children?.length ?? 0) > 0;
    this.activeTagPickerPath = canEnterRoot ? [preferredRoot] : [];
  }

  closeCaseTagPicker(): void {
    this.activeTagPickerCaseId = null;
    this.activeTagPickerPath = [];
    this.tagPickerHint = '';
  }

  isCaseTagPickerOpen(caseId: number | null | undefined): boolean {
    return !!caseId && this.activeTagPickerCaseId === caseId;
  }

  tagPickerBreadcrumb(): CaseTagTreeNode[] {
    return this.activeTagPickerPath
      .map(id => this.tagTreeNodeById.get(id))
      .filter((n): n is CaseTagTreeNode => !!n);
  }

  tagPickerItems(): CaseTagTreeNode[] {
    if (!this.activeTagPickerPath.length) {
      return this.tagTree;
    }
    const currentId = this.activeTagPickerPath[this.activeTagPickerPath.length - 1];
    return this.tagTreeNodeById.get(currentId)?.children ?? [];
  }

  tagPickerOptionActionLabel(option: CaseTagTreeNode): string {
    const depth = this.activeTagPickerPath.length;
    if (option.children?.length) {
      if (depth === 0) return 'Subcategories';
      if (depth === 1) return 'Sub-divisions';
      if (depth === 2) return 'Choices';
      return 'Next';
    }
    return 'Select';
  }

  tagPickerBack(): void {
    if (!this.activeTagPickerPath.length) {
      return;
    }
    this.activeTagPickerPath = this.activeTagPickerPath.slice(0, -1);
    this.tagPickerHint = '';
  }

  tagPickerGoTo(index: number): void {
    if (index < 0) {
      this.activeTagPickerPath = [];
      this.tagPickerHint = '';
      return;
    }
    this.activeTagPickerPath = this.activeTagPickerPath.slice(0, index + 1);
    this.tagPickerHint = '';
  }

  tagPickerSelect(caseId: number, node: CaseTagTreeNode): void {
    this.tagPickerHint = '';
    if (node.children?.length) {
      this.activeTagPickerPath = [...this.activeTagPickerPath, node.id];
      return;
    }

    this.setSingleCaseTag(caseId, node.id);
    this.closeCaseTagPicker();
  }

  clearCaseTags(caseId: number): void {
    this.tagSelectionByCase.set(caseId, new Set<number>());
  }

  executePlaylistPrimaryAction(): void {
    if (this.playlistComposerMode === 'internal') {
      this.addInternalNote('playlist');
      return;
    }
    this.submitPlaylistOnly();
  }

  executeMyCasePrimaryAction(): void {
    if (this.myCaseComposerMode === 'internal') {
      this.addInternalNote('my-case');
      return;
    }
    this.updateMyCase();
  }

  executeOpenCasePrimaryAction(): void {
    if (this.openCaseComposerMode === 'internal') {
      this.addInternalNote('open');
      return;
    }
    this.updateOpenCase();
  }

  submitPlaylistAndNext(): void {
    const oldest = this.myPlaylist.oldestCase;
    if (!oldest) {
      return;
    }

    this.errorMessage = '';
    this.submitting = true;
    const reply = this.normalizeReply(this.getEditorHtml('playlist'));
    const sendReply$ = reply
      ? this.crmService.sendReply(this.userId, oldest.id, reply).pipe(timeout(12000))
      : of({ sent: true });

    sendReply$.pipe(
      switchMap(() => this.crmService.submitMyPlaylistAndNext(this.userId, oldest.id, {
        status: this.playlistStatus,
        reply,
        tagNodeIds: this.getSelectedTagIdsForCase(oldest.id)
      })),
      timeout(12000),
      finalize(() => this.submitting = false)
    )
      .subscribe({
        next: (data) => {
          this.appendOptimisticMessage('playlist', oldest.subject || 'Reply', reply);
          this.myPlaylist = data;
          this.syncTagSelectionFromCase(data.oldestCase);
          this.clearEditor('playlist');
          if (data.oldestCase?.status) {
            this.playlistStatus = data.oldestCase.status;
          } else {
            this.playlistStatus = 'resolved';
          }
          this.loadPlaylistThread();
          this.refreshThreadWithRetry('playlist');
          this.refreshPlaylistSnapshot();
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  submitPlaylistOnly(): void {
    const oldest = this.myPlaylist.oldestCase;
    if (!oldest) {
      return;
    }

    this.errorMessage = '';
    this.submitting = true;
    const reply = this.normalizeReply(this.getEditorHtml('playlist'));
    const sendReply$ = reply
      ? this.crmService.sendReply(this.userId, oldest.id, reply).pipe(timeout(12000))
      : of({ sent: true });

    sendReply$.pipe(
      switchMap(() => this.crmService.updateAssignedCase(this.userId, oldest.id, {
        status: this.playlistStatus,
        reply,
        tagNodeIds: this.getSelectedTagIdsForCase(oldest.id)
      })),
      timeout(12000),
      finalize(() => this.submitting = false)
    )
      .subscribe({
        next: (updated) => {
          this.appendOptimisticMessage('playlist', oldest.subject || 'Reply', reply);
          this.myPlaylist = {
            ...this.myPlaylist,
            oldestCase: updated,
            cases: this.myPlaylist.cases.map(ticket => ticket.id === updated.id ? updated : ticket)
          };
          this.syncTagSelectionFromCase(updated);
          this.clearEditor('playlist');
          this.playlistStatus = updated.status || this.playlistStatus;
          this.loadPlaylistThread();
          this.refreshThreadWithRetry('playlist');
          this.refreshPlaylistSnapshot();
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  updateOpenCase(): void {
    if (!this.selectedOpenCase) {
      return;
    }

    this.errorMessage = '';
    this.submitting = true;
    const reply = this.normalizeReply(this.getEditorHtml('open'));
    const sendReply$ = reply
      ? this.crmService.sendReply(this.userId, this.selectedOpenCase.id, reply).pipe(timeout(12000))
      : of({ sent: true });

    sendReply$.pipe(
      switchMap(() => this.crmService.updateAssignedCase(this.userId, this.selectedOpenCase!.id, {
        status: this.openCaseStatus,
        reply,
        tagNodeIds: this.getSelectedTagIdsForCase(this.selectedOpenCase!.id)
      })),
      timeout(12000),
      finalize(() => this.submitting = false)
    )
      .subscribe({
        next: (updated) => {
          this.appendOptimisticMessage('open', updated.subject || 'Reply', reply);
          this.selectedOpenCase = updated;
          this.syncTagSelectionFromCase(updated);
          this.clearEditor('open');
          this.replaceOpenCase(updated);
          this.loadOpenCaseThread();
          this.refreshThreadWithRetry('open');
          this.refreshOpenCasesSnapshot(updated.id);
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  updateMyCase(): void {
    if (!this.selectedMyCase) {
      return;
    }

    this.errorMessage = '';
    this.submitting = true;
    const reply = this.normalizeReply(this.getEditorHtml('my-case'));
    const sendReply$ = reply
      ? this.crmService.sendReply(this.userId, this.selectedMyCase.id, reply).pipe(timeout(12000))
      : of({ sent: true });

    sendReply$.pipe(
      switchMap(() => this.crmService.updateAssignedCase(this.userId, this.selectedMyCase!.id, {
        status: this.myCaseStatus,
        reply,
        tagNodeIds: this.getSelectedTagIdsForCase(this.selectedMyCase!.id)
      })),
      timeout(12000),
      finalize(() => this.submitting = false)
    )
      .subscribe({
        next: (updated) => {
          this.appendOptimisticMessage('my-case', updated.subject || 'Reply', reply);
          this.selectedMyCase = updated;
          this.syncTagSelectionFromCase(updated);
          this.clearEditor('my-case');
          this.replaceMyCase(updated);
          this.loadMyCaseThread();
          this.refreshThreadWithRetry('my-case');
          this.refreshMyCasesSnapshot(updated.id);
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  addInternalNote(target: ComposerTarget): void {
    const note = this.getEditorPlainText(target);
    if (!note) {
      return;
    }

    const conversationId = target === 'playlist'
      ? this.myPlaylist.oldestCase?.id
      : (target === 'my-case' ? this.selectedMyCase?.id : this.selectedOpenCase?.id);
    if (!conversationId || !this.userId) {
      return;
    }

    this.errorMessage = '';
    this.submitting = true;
    this.crmService.addInternalNote(this.userId, conversationId, note)
      .pipe(
        timeout(12000),
        finalize(() => this.submitting = false)
      )
      .subscribe({
        next: (res: InternalNoteSaveResponse) => {
          if (res?.message) {
            this.appendThreadMessage(target, res.message);
          } else {
            this.reloadThread(target);
          }
          this.clearEditor(target);
          this.infoMessage = 'Internal note added (not sent to customer).';
          this.refreshThreadWithRetry(target);
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  private replaceMyCase(updated: CrmCase): void {
    this.myCases = this.myCases.map(ticket => ticket.id === updated.id ? updated : ticket);
  }

  private replaceOpenCase(updated: CrmCase): void {
    this.openCaseQueues = this.openCaseQueues.map(queue => ({
      ...queue,
      tickets: queue.tickets.map(ticket => ticket.id === updated.id ? updated : ticket)
    }));
  }

  private loadSelectedChoice(): void {
    if (!this.userId) {
      this.loading = false;
      this.errorMessage = 'No user session found. Please sign in again.';
      return;
    }

    this.errorMessage = '';
    this.infoMessage = '';
    this.beginLoading();
    if (this.selectedChoice !== 'all-cases') {
      this.stopAllCasesAutoSync();
    }

    if (this.selectedChoice === 'my-playlist') {
      this.crmService.getMyPlaylist(this.userId)
        .pipe(
          timeout(8000),
          finalize(() => this.endLoading())
        )
        .subscribe({
          next: data => {
              if (!data.oldestCase) {
                this.selectedChoice = 'all-cases';
                this.fetchAllCases();
                if (!this.isTicketRoute) {
                  this.syncAllCasesInBackground();
                }
                this.startAllCasesAutoSync();
                return;
              }
              this.myPlaylist = data;
              this.syncTagSelectionFromCase(data.oldestCase);
              this.clearEditor('playlist');
              this.playlistStatus = data.oldestCase?.status || 'resolved';
              this.loadPlaylistThread();
            },
          error: (error) => this.handleLoadError(error)
        });
      return;
    }

    if (this.selectedChoice === 'my-cases') {
      this.crmService.getAllCases()
        .pipe(
          timeout(8000),
          finalize(() => this.endLoading())
        )
        .subscribe({
          next: data => {
            this.myCases = data.filter(c => c.assignedUserId === this.userId);
            this.selectedMyCase = this.myCases[0] || null;
            this.syncTagSelectionFromCase(this.selectedMyCase);
            this.myCaseStatus = this.selectedMyCase?.status || 'pending';
            this.clearEditor('my-case');
            this.loadMyCaseThread();
          },
          error: (error) => this.handleLoadError(error)
        });
      return;
    }

    if (this.selectedChoice === 'open-cases') {
      this.crmService.getOpenCases(this.userId)
        .pipe(
          timeout(8000),
          finalize(() => this.endLoading())
        )
        .subscribe({
          next: data => {
            this.openCaseQueues = data;
            this.selectedOpenCase = data.flatMap(queue => queue.tickets)[0] || null;
            this.syncTagSelectionFromCase(this.selectedOpenCase);
            this.openCaseStatus = this.selectedOpenCase?.status || 'pending';
            this.clearEditor('open');
            this.loadOpenCaseThread();
          },
          error: (error) => this.handleLoadError(error)
        });
      return;
    }

    if (this.selectedChoice === 'my-chats') {
      this.loadMyChats();
      this.endLoading();
      return;
    }

    this.fetchAllCases();
    if (!this.isTicketRoute) {
      this.syncAllCasesInBackground();
    }
    this.startAllCasesAutoSync();
  }

  refreshAllCases(): void {
    if (this.isTicketRoute) {
      return;
    }
    if (this.loading || this.syncing || !this.userId) {
      return;
    }
    this.errorMessage = '';
    this.infoMessage = '';
    this.beginLoading();
    this.loadAllCases(true);
  }

  private loadAllCases(syncFirst: boolean): void {
    if (syncFirst) {
      this.syncing = true;
      this.crmService.syncInbox(this.userId)
        .pipe(
          timeout(15000),
          finalize(() => this.syncing = false)
        )
        .subscribe({
          next: result => {
            this.fetchAllCases();
          },
          error: () => {
            this.fetchAllCases();
          }
        });
      return;
    }

    this.fetchAllCases();
  }

  private fetchAllCases(): void {
    this.crmService.getAllCases()
      .pipe(
        timeout(8000),
        finalize(() => this.endLoading())
      )
      .subscribe({
        next: data => {
          this.allCases = data;
          this.applyDeepLink();
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  private loadMyChats(): void {
    this.chatLoading = true;
    this.loadChatWidgetConfig();
    this.crmService.getChatChannels(this.userId)
      .pipe(
        switchMap((channels) => this.autoLinkChatChannels(channels)),
        switchMap((channels) => {
          this.chatChannels = channels;
          return this.crmService.getMyChats(this.userId);
        }),
        finalize(() => this.chatLoading = false)
      )
      .subscribe({
        next: (threads) => {
          this.chatThreads = threads;
          const keepSelected = this.selectedChatThreadId && threads.some(t => t.id === this.selectedChatThreadId);
          this.selectedChatThreadId = keepSelected ? this.selectedChatThreadId : (threads[0]?.id ?? null);
          if (this.selectedChatThreadId) {
            this.loadChatMessages(this.selectedChatThreadId);
          }
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  private autoLinkChatChannels(channels: ChatChannel[]) {
    const toLink = channels.filter(c => !c.connected && (c.type === 'whatsapp' || c.type === 'instagram'));
    if (!toLink.length) {
      return of(channels);
    }

    return forkJoin(
      toLink.map(channel =>
        this.crmService.linkChatChannel(this.userId, channel.type, channel.handle)
          .pipe(
            timeout(8000),
            catchError(() => of(channel))
          )
      )
    ).pipe(
      map((updated) => {
        const byType = new Map(updated.map(item => [item.type, item]));
        return channels.map(channel => byType.get(channel.type) ?? channel);
      })
    );
  }

  private loadChatWidgetConfig(): void {
    this.crmService.getChatWidgetConfig(this.userId)
      .pipe(timeout(8000))
      .subscribe({
        next: (config) => this.applyChatWidgetConfig(config),
        error: () => {
          this.chatWidgetToken = '';
          this.chatWidgetSnippet = '';
        }
      });
  }

  private loadChatMessages(conversationId: number): void {
    this.crmService.getChatMessages(this.userId, conversationId)
      .pipe(timeout(8000))
      .subscribe({
        next: (messages) => {
          this.chatMessagesByThread.set(conversationId, messages);
          const thread = this.chatThreads.find(t => t.id === conversationId);
          if (thread) {
            thread.unread = 0;
          }
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  getSelectedChatMessages(): ChatMessage[] {
    const thread = this.selectedChatThread;
    if (!thread) return [];
    return this.chatMessagesByThread.get(thread.id) ?? [];
  }

  getFilteredChatThreads(): ChatConversation[] {
    const q = this.chatSearch.trim().toLowerCase();
    if (!q) return this.chatThreads;
    return this.chatThreads.filter(thread =>
      thread.customerName.toLowerCase().includes(q)
      || thread.customerHandle.toLowerCase().includes(q)
      || thread.channel.toLowerCase().includes(q)
      || thread.status.toLowerCase().includes(q)
    );
  }

  selectChatThread(thread: ChatConversation): void {
    this.selectedChatThreadId = thread.id;
    this.loadChatMessages(thread.id);
  }

  linkChannel(channelType: 'whatsapp' | 'instagram'): void {
    const channel = this.chatChannels.find(c => c.type === channelType);
    if (!channel) return;

    if (channel.connected) {
      this.crmService.unlinkChatChannel(this.userId, channelType)
        .pipe(timeout(8000))
        .subscribe({
          next: (updated) => {
            this.chatChannels = this.chatChannels.map(c => c.type === channelType ? updated : c);
            this.infoMessage = `${updated.label} disconnected.`;
          },
          error: (error) => this.handleLoadError(error)
        });
      return;
    }

    this.crmService.startChatOauth(this.userId, channelType)
      .pipe(timeout(8000))
      .subscribe({
        next: ({ authUrl }) => {
          if (typeof window !== 'undefined') {
            window.open(authUrl, '_blank', 'noopener,noreferrer');
          }
          this.infoMessage = `Complete ${channel.label} authorization in the opened window, then refresh chats.`;
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  saveChatWidgetConfig(): void {
    this.chatWidgetSaving = true;
    this.crmService.updateChatWidgetConfig(this.userId, {
      websiteName: this.chatWidgetWebsiteName.trim() || 'My Website',
      enabled: this.chatWidgetEnabled
    })
      .pipe(
        timeout(8000),
        finalize(() => this.chatWidgetSaving = false)
      )
      .subscribe({
        next: (config) => {
          this.applyChatWidgetConfig(config);
          this.infoMessage = 'Website chat widget settings saved.';
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  copyChatWidgetSnippet(): void {
    const snippet = (this.chatWidgetSnippet || '').trim();
    if (!snippet) {
      this.errorMessage = 'Save and enable the widget first.';
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      this.infoMessage = snippet;
      return;
    }
    navigator.clipboard.writeText(snippet)
      .then(() => this.infoMessage = 'Widget snippet copied.')
      .catch(() => this.errorMessage = 'Could not copy the widget snippet.');
  }

  simulateInboundChat(channelType: 'whatsapp' | 'instagram'): void {
    const channel = this.chatChannels.find(c => c.type === channelType);
    if (!channel || !channel.connected) {
      this.errorMessage = 'Link the channel first.';
      return;
    }
    const random = Math.floor(Math.random() * 9000) + 1000;
    const customerName = channelType === 'whatsapp' ? `WA Customer ${random}` : `IG Customer ${random}`;
    const customerHandle = channelType === 'whatsapp' ? `+2126${random}${random}` : `@ig_${random}`;
    const text = channelType === 'whatsapp'
      ? 'Hello, I need help with my account update.'
      : 'Hi, can you check my latest case status?';

    this.crmService.ingestInboundChat({
      channel: channelType,
      customerName,
      customerHandle,
      text
    })
      .pipe(timeout(8000))
      .subscribe({
        next: (conversation) => {
          this.infoMessage = `Inbound ${channelType} chat received and assigned to ${conversation.assignedTo}.`;
          this.loadMyChats();
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  sendChatReply(): void {
    const thread = this.selectedChatThread;
    const text = this.newChatReply.trim();
    if (!thread || !text) return;

    this.crmService.replyChat(this.userId, thread.id, text)
      .pipe(timeout(8000))
      .subscribe({
        next: (message) => {
          this.newChatReply = '';
          const current = this.chatMessagesByThread.get(thread.id) ?? [];
          this.chatMessagesByThread.set(thread.id, [...current, message]);
          this.loadMyChats();
          this.infoMessage = 'Chat reply sent.';
        },
        error: (error) => this.handleLoadError(error)
      });
  }

  private applyChatWidgetConfig(config: ChatWidgetConfig): void {
    this.chatWidgetWebsiteName = config.websiteName || 'My Website';
    this.chatWidgetEnabled = !!config.enabled;
    this.chatWidgetToken = config.widgetToken || '';
    this.chatWidgetSnippet = config.scriptSnippet || '';
  }

  private syncAllCasesInBackground(): void {
    this.syncing = true;
    this.crmService.syncInbox(this.userId)
      .pipe(
        timeout(15000),
        finalize(() => this.syncing = false)
      )
      .subscribe({
        next: () => {
          if (this.selectedChoice === 'all-cases' && !this.loading) {
            this.fetchAllCases();
          }
        },
        error: () => {}
      });
  }

  private handleLoadError(error: unknown): void {
    console.error('Failed to load CRM data', error);
    if (this.isHttpError(error)) {
      const apiMessage = this.extractApiMessage(error);
      if (
        error.status === 502
        && apiMessage
        && apiMessage.toLowerCase().includes('failed to refresh gmail access token')
      ) {
        this.errorMessage = '';
        this._infoMessage = 'Gmail sync token expired. CRM data is shown from local database; reconnect Gmail when needed.';
        this.pushToast('info', this._infoMessage, 'gmail-oauth');
        this.endLoading();
        return;
      }
      if (error.status === 401 || error.status === 403) {
        const authIssue = error.status === 401 ? 'not authenticated' : 'forbidden';
        this.errorMessage = `CRM request failed (${error.status} ${authIssue}). Please login again and verify your account access.`;
      } else if (error.status === 0) {
        this.errorMessage = 'Could not reach CRM API. Verify the backend is running.';
      } else {
        this.errorMessage = apiMessage
          ? `CRM request failed (${error.status}): ${apiMessage}`
          : `CRM request failed with status ${error.status}.`;
      }
    } else {
      this.errorMessage = 'Could not load CRM data. Verify the API is running.';
    }
    this.endLoading();
  }

  private isHttpError(value: unknown): value is { status: number; error?: any } {
    return typeof value === 'object' && value !== null && 'status' in value;
  }

  private extractApiMessage(error: { error?: any }): string {
    const body = error.error;
    if (!body) return '';
    if (typeof body === 'string') return body.trim();
    if (typeof body.message === 'string') return body.message.trim();
    if (typeof body.error === 'string') return body.error.trim();
    return '';
  }

  private loadPlaylistThread(): void {
    const current = this.myPlaylist.oldestCase;
    if (!current) {
      this.playlistThread = null;
      return;
    }
    this.threadLoading = true;
    this.crmService.getThread(this.userId, current.id)
      .pipe(
        timeout(12000),
        finalize(() => this.threadLoading = false)
      )
      .subscribe({
        next: data => {
          this.playlistThread = this.normalizeThreadForDisplay(data);
          this.requestThreadScroll('playlist', true, 'auto');
          this.applyDeepLink();
        },
        error: () => this.playlistThread = null
      });
  }

  private loadOpenCaseThread(): void {
    const current = this.selectedOpenCase;
    if (!current) {
      this.openCaseThread = null;
      return;
    }
    this.threadLoading = true;
    this.crmService.getThread(this.userId, current.id)
      .pipe(
        timeout(12000),
        finalize(() => this.threadLoading = false)
      )
      .subscribe({
        next: data => {
          this.openCaseThread = this.normalizeThreadForDisplay(data);
          this.requestThreadScroll('open', true, 'auto');
          this.applyDeepLink();
        },
        error: () => this.openCaseThread = null
      });
  }

  private loadMyCaseThread(): void {
    const current = this.selectedMyCase;
    if (!current) {
      this.myCaseThread = null;
      return;
    }
    this.threadLoading = true;
    this.crmService.getThread(this.userId, current.id)
      .pipe(
        timeout(12000),
        finalize(() => this.threadLoading = false)
      )
      .subscribe({
        next: data => {
          this.myCaseThread = this.normalizeThreadForDisplay(data);
          this.requestThreadScroll('my-case', true, 'auto');
          this.applyDeepLink();
        },
        error: () => this.myCaseThread = null
      });
  }

  private loadCaseTagTree(): void {
    this.tagTreeLoaded = false;
    this.tagTreeError = '';
    this.caseTagsService.getMap()
      .pipe(timeout(8000))
      .subscribe({
        next: (map) => {
          const nodes = Array.isArray(map?.nodes) ? map.nodes : [];
          const edges = Array.isArray(map?.edges) ? map.edges : [];
          this.caseTagNodeLookup = new Map(nodes.map(node => [node.id, node]));
          this.tagTree = this.buildCaseTagTree(nodes, edges);
          this.rebuildTagTreeLookups(this.tagTree);
          this.tagTreeLoaded = true;
        },
        error: () => {
          this.tagTree = [];
          this.caseTagNodeLookup.clear();
          this.rebuildTagTreeLookups([]);
          this.tagTreeLoaded = true;
          this.tagTreeError = 'Case tag tree is not configured yet.';
        }
      });
  }

  private buildCaseTagTree(nodes: CaseTagNode[], edges: CaseTagEdge[]): CaseTagTreeNode[] {
    if (!nodes.length) {
      return [];
    }

    const childrenBySource = new Map<number, number[]>();
    for (const edge of edges
      .filter(edge => edge.sourceNodeId != null && edge.targetNodeId != null)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))) {
      const list = childrenBySource.get(edge.sourceNodeId) ?? [];
      if (!list.includes(edge.targetNodeId)) {
        list.push(edge.targetNodeId);
      }
      childrenBySource.set(edge.sourceNodeId, list);
    }

    const targetedNodeIds = new Set<number>(edges.map(edge => edge.targetNodeId));
    const startNodes = nodes.filter(node => !!node.isStart);
    const rootIds = (startNodes.length ? startNodes : nodes.filter(node => !targetedNodeIds.has(node.id)))
      .map(node => node.id);
    const allRootIds = rootIds.length ? rootIds : [nodes[0].id];

    const result: CaseTagTreeNode[] = [];
    const added = new Set<number>();

    const markAdded = (node: CaseTagTreeNode): void => {
      if (added.has(node.id)) return;
      added.add(node.id);
      for (const child of (node.children ?? [])) {
        markAdded(child);
      }
    };
    for (const rootId of allRootIds) {
      const treeNode = this.buildCaseTagTreeNode(rootId, childrenBySource, new Set<number>());
      if (treeNode && !added.has(treeNode.id)) {
        result.push(treeNode);
        markAdded(treeNode);
      }
    }

    for (const node of nodes) {
      if (added.has(node.id)) {
        continue;
      }
      const treeNode = this.buildCaseTagTreeNode(node.id, childrenBySource, new Set<number>());
      if (treeNode) {
        result.push(treeNode);
        markAdded(treeNode);
      }
    }

    return result;
  }

  private getRootTagId(tagNodeId: number): number | null {
    let current: number | null | undefined = tagNodeId;
    const guard = new Set<number>();
    while (current != null && current !== 0 && !guard.has(current)) {
      guard.add(current);
      const parent = this.tagParentById.get(current);
      if (parent == null) {
        return current;
      }
      current = parent;
    }
    return null;
  }

  private pickDefaultRootTagId(): number | null {
    if (!this.tagTree?.length) {
      return null;
    }

    const roots = this.tagTree.slice();
    const withChildren = roots.filter(r => (r.children?.length ?? 0) > 0);
    const candidates = (withChildren.length ? withChildren : roots)
      .sort((a, b) => (a.label || '').localeCompare((b.label || '')) || a.id - b.id);

    return candidates[0]?.id ?? null;
  }

  private buildCaseTagTreeNode(
    nodeId: number,
    childrenBySource: Map<number, number[]>,
    branchVisited: Set<number>
  ): CaseTagTreeNode | null {
    const node = this.caseTagNodeLookup.get(nodeId);
    if (!node) {
      return null;
    }
    if (branchVisited.has(nodeId)) {
      return {
        id: node.id,
        label: node.label || `Tag #${node.id}`,
        content: node.content || '',
        children: []
      };
    }

    const nextVisited = new Set(branchVisited);
    nextVisited.add(nodeId);
    const children: CaseTagTreeNode[] = [];
    for (const childId of (childrenBySource.get(nodeId) ?? [])) {
      const childNode = this.buildCaseTagTreeNode(childId, childrenBySource, nextVisited);
      if (childNode) {
        children.push(childNode);
      }
    }

    return {
      id: node.id,
      label: node.label || `Tag #${node.id}`,
      content: node.content || '',
      children
    };
  }

  private rebuildTagTreeLookups(tree: CaseTagTreeNode[]): void {
    this.tagTreeNodeById.clear();
    this.tagParentById.clear();

    const visit = (node: CaseTagTreeNode, parentId: number | null): void => {
      this.tagTreeNodeById.set(node.id, node);
      this.tagParentById.set(node.id, parentId);
      for (const child of (node.children ?? [])) {
        visit(child, node.id);
      }
    };

    for (const root of (tree ?? [])) {
      visit(root, null);
    }
  }

  private getTagLeafLabel(tagNodeId: number): string {
    const label = this.tagTreeNodeById.get(tagNodeId)?.label?.trim()
      || this.caseTagNodeLookup.get(tagNodeId)?.label?.trim();
    return label || `Tag #${tagNodeId}`;
  }

  private getTagPathLabel(tagNodeId: number): string {
    const labels: string[] = [];
    let current: number | null | undefined = tagNodeId;
    const guard = new Set<number>();
    while (current != null && current !== 0 && !guard.has(current)) {
      guard.add(current);
      labels.push(this.getTagLeafLabel(current));
      current = this.tagParentById.get(current) ?? null;
    }
    if (labels.length <= 1) {
      return this.getTagLeafLabel(tagNodeId);
    }
    return labels.reverse().join(' / ');
  }

  private setSingleCaseTag(caseId: number, tagNodeId: number): void {
    this.tagSelectionByCase.set(caseId, new Set<number>([tagNodeId]));
  }

  private syncTagSelectionFromCase(caseItem: CrmCase | null | undefined): void {
    if (!caseItem?.id) {
      return;
    }
    const incoming = Array.isArray(caseItem.tagNodeIds) ? caseItem.tagNodeIds : [];
    this.tagSelectionByCase.set(caseItem.id, new Set(incoming.filter(id => typeof id === 'number')));
  }

  private getTagSetForCase(caseId: number): Set<number> {
    let existing = this.tagSelectionByCase.get(caseId);
    if (!existing) {
      existing = new Set<number>();
      this.tagSelectionByCase.set(caseId, existing);
    }
    return existing;
  }

  private getSelectedTagIdsForCase(caseId: number): number[] {
    return Array.from(this.getTagSetForCase(caseId)).sort((a, b) => a - b);
  }

  formatReply(target: ComposerTarget, command: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const editor = this.getEditor(target);
    if (!editor) {
      return;
    }
    this.enforceEditorLtr(editor);
    editor.focus();
    if (command === 'createLink') {
      const url = prompt('Enter URL');
      if (!url) {
        return;
      }
      document.execCommand('createLink', false, url);
      return;
    }
    document.execCommand(command, false);
  }

  private normalizeReply(html: string): string {
    if (!html || html.trim() === '') {
      return '';
    }
    return html.trim();
  }

  onEditorInput(target: ComposerTarget, event: Event): void {
    const editor = event.target as HTMLElement | null;
    if (!editor) return;
    this.enforceEditorLtr(editor);
    this.upgradeEditorImages(target, editor);
  }

  onEditorFocus(target: ComposerTarget, event: Event): void {
    const editor = event.target as HTMLElement | null;
    this.enforceEditorLtr(editor);
    if (editor) {
      this.upgradeEditorImages(target, editor);
    }
  }

  onEditorKeyup(target: ComposerTarget, event: Event): void {
    const editor = event.target as HTMLElement | null;
    if (!editor) {
      return;
    }
    this.enforceEditorLtr(editor);
    this.upgradeEditorImages(target, editor);
  }

  onEditorClick(target: ComposerTarget, event: MouseEvent): void {
    const el = event.target as HTMLElement | null;
    const editor = this.getEditor(target);
    if (!editor) {
      this.clearActiveImage();
      return;
    }
    const wrap = el?.closest('.editor-image-wrap') as HTMLElement | null;
    const wrapImg = wrap?.querySelector('img') as HTMLImageElement | null;
    const directImg = el?.tagName === 'IMG'
      ? (el as HTMLImageElement)
      : (el?.closest('img') as HTMLImageElement | null);
    const img = wrapImg ?? directImg;
    if (!img || !editor.contains(img)) {
      this.clearActiveImage();
      return;
    }
    if (!img.closest('.editor-image-wrap')) {
      this.wrapEditorImage(target, img);
    }
    this.setActiveImage(target, img);
  }

  onEditorPaste(target: ComposerTarget, event: ClipboardEvent): void {
    try {
      const files = Array.from(event.clipboardData?.files ?? []).filter(f => (f.type || '').startsWith('image/'));
      if (!files.length) {
        // Let the browser paste, then wrap any <img> tags it inserts.
        setTimeout(() => {
          const editor = this.getEditor(target);
          if (editor) {
            this.upgradeEditorImages(target, editor);
          }
        }, 0);
        return;
      }
      event.preventDefault();
      // Only insert the first image for now.
      this.insertImageFile(target, files[0]);
      setTimeout(() => {
        const editor = this.getEditor(target);
        if (editor) {
          this.upgradeEditorImages(target, editor);
        }
      }, 0);
    } catch {
      // ignore
    }
  }

  private enforceEditorLtr(editor: HTMLElement | null): void {
    if (!editor) {
      return;
    }
    editor.setAttribute('dir', 'ltr');
    editor.style.direction = 'ltr';
    editor.style.textAlign = 'left';
    editor.style.unicodeBidi = 'isolate';
    editor.style.writingMode = 'horizontal-tb';
  }

  private getEditor(target: ComposerTarget): HTMLElement | null {
    if (target === 'playlist') return this.playlistEditor?.nativeElement ?? null;
    if (target === 'my-case') return this.myCaseEditor?.nativeElement ?? null;
    return this.openEditor?.nativeElement ?? null;
  }

  private getEditorHtml(target: ComposerTarget): string {
    const editor = this.getEditor(target);
    if (!editor) return '';
    if (typeof document === 'undefined') {
      return editor.innerHTML?.trim() ?? '';
    }

    // Clone and strip image UI helpers so the outgoing email HTML stays clean.
    const clone = editor.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.editor-image-handle').forEach(el => el.remove());
    clone.querySelectorAll('.editor-image-wrap').forEach(wrap => {
      const img = wrap.querySelector('img');
      if (img) {
        wrap.replaceWith(img);
      } else {
        wrap.remove();
      }
    });
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    return (clone.innerHTML || '').trim();
  }

  private clearEditor(target: ComposerTarget): void {
    const editor = this.getEditor(target);
    if (!editor) {
      return;
    }
    editor.innerHTML = '';
    this.enforceEditorLtr(editor);
  }

  private getEditorPlainText(target: ComposerTarget): string {
    const html = this.getEditorHtml(target);
    if (!html) {
      return '';
    }
    if (typeof document === 'undefined') {
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const container = document.createElement('div');
    container.innerHTML = html;
    return (container.textContent || container.innerText || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  triggerImagePicker(target: ComposerTarget): void {
    const input =
      target === 'playlist'
        ? (this.playlistImageInput?.nativeElement ?? null)
        : (target === 'my-case'
          ? (this.myCaseImageInput?.nativeElement ?? null)
          : (this.openImageInput?.nativeElement ?? null));
    if (!input) return;
    input.value = '';
    input.click();
  }

  onImageFileChosen(target: ComposerTarget, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    this.insertImageFile(target, file);
    // Reset value so selecting the same file again triggers change.
    try { input.value = ''; } catch { /* ignore */ }
  }

  private insertImageFile(target: ComposerTarget, file: File): void {
    if (typeof FileReader === 'undefined') return;
    if (!(file.type || '').startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (!src) return;
      this.insertImageAtCursor(target, src, file.name || 'image');
    };
    reader.readAsDataURL(file);
  }

  private insertImageAtCursor(target: ComposerTarget, src: string, alt: string): void {
    const editor = this.getEditor(target);
    if (!editor || typeof document === 'undefined') return;
    editor.focus();

    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || 'image';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';

    const sel = window.getSelection?.();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      // Move cursor after the image.
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.appendChild(img);
    }

    // Add a trailing space so it's easy to continue typing after the image.
    editor.appendChild(document.createTextNode(' '));

    this.upgradeEditorImages(target, editor);
    this.setActiveImage(target, img);
  }

  private upgradeEditorImages(target: ComposerTarget, editor: HTMLElement): void {
    if (typeof document === 'undefined') return;
    const imgs = Array.from(editor.querySelectorAll('img')) as HTMLImageElement[];
    for (const img of imgs) {
      if (img.closest('.editor-image-wrap')) continue;
      this.wrapEditorImage(target, img);
    }
  }

  private wrapEditorImage(target: ComposerTarget, img: HTMLImageElement): void {
    if (typeof document === 'undefined') return;
    const editor = this.getEditor(target);
    if (!editor) return;

    const wrap = document.createElement('span');
    wrap.className = 'editor-image-wrap';
    wrap.setAttribute('contenteditable', 'false');

    img.classList.add('editor-image');
    img.style.maxWidth = '100%';
    img.style.height = 'auto';

    const handle = document.createElement('span');
    handle.className = 'editor-image-handle';
    handle.title = 'Drag to resize';

    const parent = img.parentNode;
    if (!parent) return;
    parent.insertBefore(wrap, img);
    wrap.appendChild(img);
    wrap.appendChild(handle);

    handle.addEventListener('mousedown', (e) => this.startImageResize(e, target, img));
    handle.addEventListener('touchstart', (e) => this.startImageResize(e, target, img), { passive: false });

    // Clicking the image should select it for preset sizing.
    wrap.addEventListener('click', () => this.setActiveImage(target, img));
  }

  private startImageResize(event: Event, target: ComposerTarget, img: HTMLImageElement): void {
    if (typeof window === 'undefined') return;
    event.preventDefault();
    event.stopPropagation();
    this.setActiveImage(target, img);

    const startX = (event as MouseEvent).clientX ?? (event as TouchEvent).touches?.[0]?.clientX ?? 0;
    const rect = img.getBoundingClientRect();
    this.imageResizeActive = true;
    this.imageResizeStartX = startX;
    this.imageResizeStartWidth = rect.width || img.width || 200;

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.imageResizeActive) return;
      const clientX = (e as MouseEvent).clientX ?? (e as TouchEvent).touches?.[0]?.clientX ?? 0;
      const dx = clientX - this.imageResizeStartX;
      const next = Math.max(80, Math.min(this.imageResizeStartWidth + dx, 1400));
      this.applyImageWidthPx(img, next);
      this.refreshActiveImageLabel();
    };
    const onUp = () => {
      this.imageResizeActive = false;
      window.removeEventListener('mousemove', onMove as any);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove as any);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove as any, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  private setActiveImage(target: ComposerTarget, img: HTMLImageElement): void {
    this.clearActiveImageSelection();
    this.activeImage = img;
    this.activeImageTarget = target;
    const wrap = img.closest('.editor-image-wrap') as HTMLElement | null;
    if (wrap) {
      wrap.classList.add('selected');
    }
    this.refreshActiveImageLabel();
    // Pasted images can report 0 width until they load.
    if (!this.activeImageWidthLabel) {
      setTimeout(() => this.refreshActiveImageLabel(), 60);
      setTimeout(() => this.refreshActiveImageLabel(), 220);
      setTimeout(() => this.refreshActiveImageLabel(), 520);
    }
    try {
      img.addEventListener('load', () => this.refreshActiveImageLabel(), { once: true });
    } catch {
      // ignore
    }
  }

  private clearActiveImageSelection(): void {
    if (this.activeImage) {
      const wrap = this.activeImage.closest('.editor-image-wrap') as HTMLElement | null;
      if (wrap) wrap.classList.remove('selected');
    }
  }

  private clearActiveImage(): void {
    this.clearActiveImageSelection();
    this.activeImage = null;
    this.activeImageTarget = null;
    this.activeImageWidthLabel = '';
  }

  private refreshActiveImageLabel(): void {
    const img = this.activeImage;
    if (!img) {
      this.activeImageWidthLabel = '';
      return;
    }
    const w = img.getBoundingClientRect?.().width || img.width || 0;
    this.activeImageWidthLabel = w ? `${Math.round(w)}px` : '';
  }

  setActiveImagePreset(preset: 'sm' | 'md' | 'lg' | 'fit' | 'orig'): void {
    const img = this.activeImage;
    const target = this.activeImageTarget;
    if (!img || !target) return;
    const editor = this.getEditor(target);
    const editorWidth = editor?.getBoundingClientRect?.().width ?? 0;
    const base = Math.max(240, editorWidth ? editorWidth - 24 : 600);

    if (preset === 'fit') {
      // Use a real pixel width so the size survives Angular HTML sanitization (style attr is stripped).
      this.applyImageWidthPx(img, base);
      this.refreshActiveImageLabel();
      return;
    }
    if (preset === 'orig') {
      this.clearImageWidth(img);
      this.refreshActiveImageLabel();
      return;
    }
    const scale = preset === 'sm' ? 0.33 : (preset === 'md' ? 0.55 : 0.8);
    const px = Math.round(base * scale);
    this.applyImageWidthPx(img, px);
    this.refreshActiveImageLabel();
  }

  private applyImageWidthPx(img: HTMLImageElement, px: number): void {
    const next = Math.round(Math.max(1, px));
    img.setAttribute('width', String(next));
    // Keep max-width responsive and height sensible in the editor.
    img.style.width = `${next}px`;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.removeAttribute('height');
  }

  private clearImageWidth(img: HTMLImageElement): void {
    img.removeAttribute('width');
    img.style.removeProperty('width');
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.removeAttribute('height');
  }

  removeActiveImage(): void {
    const img = this.activeImage;
    if (!img) return;
    const wrap = img.closest('.editor-image-wrap') as HTMLElement | null;
    if (wrap) {
      wrap.remove();
    } else {
      img.remove();
    }
    this.clearActiveImage();
  }

  private beginLoading(): void {
    this.loading = true;
    if (this.loadingGuardTimer) {
      clearTimeout(this.loadingGuardTimer);
    }
    this.loadingGuardTimer = setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.errorMessage = 'CRM request timed out. Please try again.';
      }
    }, 10000);
  }

  private endLoading(): void {
    this.loading = false;
    if (this.loadingGuardTimer) {
      clearTimeout(this.loadingGuardTimer);
      this.loadingGuardTimer = null;
    }
  }

  ticketLink(ticketId: number): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/crm/ticket/${ticketId}`;
  }

  copyLink(url: string): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      this.infoMessage = url;
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      this.infoMessage = 'Link copied.';
    });
  }

  selectAllCase(item: CrmCase): void {
    this.selectedAllCaseId = item.id;
    this.selectedChoice = 'all-cases';
    this.deepLinkTicketId = item.id;
    this.loadSelectedCaseEvaluations();
    this.loadAllCaseThread();
    this.router.navigate(['/crm/ticket', item.id], { replaceUrl: true });
  }

  clearSelectedAllCase(): void {
    this.selectedAllCaseId = null;
    this.allCaseEvaluations = [];
    this.allCaseThread = null;
    this.router.navigate(['/crm'], { queryParams: { tab: 'all-cases' }, replaceUrl: true });
  }

  openTicket(choice: CrmChoice, ticketId: number): void {
    this.selectedChoice = choice;
    this.deepLinkTicketId = ticketId;
    if (choice === 'open-cases') {
      this.loadSelectedChoice();
    } else if (choice === 'my-cases') {
      this.loadSelectedChoice();
    } else {
      const existing = this.allCases.find(c => c.id === ticketId);
      if (existing) {
        this.selectAllCase(existing);
        return;
      }
      this.beginLoading();
      this.fetchAllCases();
    }
    this.router.navigate(['/crm/ticket', ticketId], { replaceUrl: true });
  }

  private applyDeepLink(): void {
    if (!this.deepLinkTicketId) {
      return;
    }
    const id = this.deepLinkTicketId;
    if (this.selectedChoice === 'open-cases') {
      const match = this.openCaseQueues.flatMap(q => q.tickets).find(t => t.id === id);
      if (match) {
        this.selectedOpenCase = match;
        this.openCaseStatus = match.status || 'pending';
        this.deepLinkTicketId = null;
      }
      return;
    }
    if (this.selectedChoice === 'my-playlist') {
      const match = this.myPlaylist.cases.find(t => t.id === id);
      if (match) {
        this.deepLinkTicketId = null;
        this.selectPlaylistCase(match);
      }
      return;
    }
    if (this.selectedChoice === 'my-cases') {
      const match = this.myCases.find(t => t.id === id);
      if (match) {
        this.selectedMyCase = match;
        this.myCaseStatus = match.status || 'pending';
        this.deepLinkTicketId = null;
      }
      return;
    }
    if (this.selectedChoice === 'all-cases') {
      const match = this.allCases.find(t => t.id === id);
      if (match) {
        this.selectedAllCaseId = match.id;
        this.deepLinkTicketId = null;
        this.loadSelectedCaseEvaluations();
        this.loadAllCaseThread();
      } else if (this.isTicketRoute) {
        this.errorMessage = `Ticket #${id} is not available for your account.`;
      }
    }
  }

  private loadAllCaseThread(): void {
    const current = this.selectedAllCase;
    if (!current) {
      this.allCaseThread = null;
      return;
    }
    this.allCaseThreadLoading = true;
    this.crmService.getThread(this.userId, current.id)
      .pipe(
        timeout(12000),
        finalize(() => this.allCaseThreadLoading = false)
      )
      .subscribe({
        next: data => {
          this.allCaseThread = this.normalizeThreadForDisplay(data);
          this.requestThreadScroll('all', true, 'auto');
        },
        error: () => this.allCaseThread = null
      });
  }

  private normalizeThreadForDisplay(data: GmailThreadResponse): GmailThreadResponse {
    if (!data || !Array.isArray(data.messages)) {
      return data;
    }
    return {
      ...data,
      messages: data.messages.map(m => ({
        ...m,
        // Preserve image sizing despite Angular stripping inline styles in [innerHTML].
        body: this.promoteImgWidthStylesToAttributes(m.body)
      }))
    };
  }

  private promoteImgWidthStylesToAttributes(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const root = doc.body.firstElementChild as HTMLElement | null;
        if (!root) {
          return html;
        }
        const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
        for (const img of imgs) {
          const existing = (img.getAttribute('width') || '').trim();
          if (existing) continue;
          const style = img.getAttribute('style') || '';
          const px = this.extractPxFromStyle(style, 'width') ?? this.extractPxFromStyle(style, 'max-width');
          if (px && Number.isFinite(px) && px > 0) {
            img.setAttribute('width', String(Math.round(px)));
          }
        }
        return root.innerHTML;
      } catch {
        // fall through to regex fallback
      }
    }

    return html.replace(/<img\b([^>]*?)\/?>/gi, (full, attrs: string) => {
      if (/\bwidth\s*=\s*["']?\d+/i.test(attrs)) return full;
      const styleMatch = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/i);
      if (!styleMatch) return full;
      const style = styleMatch[1] || '';
      const wMatch =
        style.match(/\bwidth\s*:\s*([0-9.]+)\s*px\b/i)
        || style.match(/\bmax-width\s*:\s*([0-9.]+)\s*px\b/i);
      if (!wMatch) return full;
      const w = Number(wMatch[1]);
      if (!Number.isFinite(w) || w <= 0) return full;
      const suffix = full.endsWith('/>') ? '/>' : '>';
      return `<img${attrs} width=\"${Math.round(w)}\"${suffix}`;
    });
  }

  private extractPxFromStyle(style: string, prop: 'width' | 'max-width'): number | null {
    if (!style) return null;
    const match = style.match(new RegExp(`\\b${prop}\\s*:\\s*([0-9.]+)\\s*px\\b`, 'i'));
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  }

  loadSelectedCaseEvaluations(): void {
    if (!this.canSeeQaEvaluations) {
      this.allCaseEvaluations = [];
      return;
    }
    const caseId = this.selectedAllCaseId;
    if (!caseId) {
      this.allCaseEvaluations = [];
      return;
    }
    this.evaluationsLoading = true;
    this.evaluationsError = '';
    this.crmService.getEvaluationsByCase(caseId)
      .pipe(finalize(() => this.evaluationsLoading = false))
      .subscribe({
        next: (items) => this.allCaseEvaluations = items,
        error: () => {
          this.allCaseEvaluations = [];
          this.evaluationsError = 'Could not load QA evaluations.';
        }
      });
  }

  createQaEvaluation(): void {
    const current = this.selectedAllCase;
    if (!current || !current.id) {
      this.evaluationsError = 'Select a case first.';
      return;
    }
    if (!current.assignedUserId) {
      this.evaluationsError = 'This case has no assigned agent to evaluate.';
      return;
    }
    this.qaSubmitting = true;
    this.evaluationsError = '';
    this.crmService.createEvaluation({
      conversationId: current.id,
      evaluatedUserId: current.assignedUserId,
      score: this.qaScore,
      strengths: this.qaStrengths,
      improvements: this.qaImprovements,
      comment: this.qaComment
    }).pipe(finalize(() => this.qaSubmitting = false))
      .subscribe({
        next: (created) => {
          this.allCaseEvaluations = [created, ...this.allCaseEvaluations];
          this.qaStrengths = '';
          this.qaImprovements = '';
          this.qaComment = '';
          this.infoMessage = 'QA evaluation created.';
        },
        error: (err) => {
          this.evaluationsError = err?.error?.message || 'Failed to create evaluation.';
        }
      });
  }

  private appendOptimisticMessage(target: ComposerTarget, subject: string, replyHtml: string): void {
    if (!replyHtml) {
      return;
    }
    const thread = target === 'playlist'
      ? this.playlistThread
      : (target === 'my-case' ? this.myCaseThread : this.openCaseThread);
    if (!thread) {
      return;
    }
    const optimistic = {
      id: `local-${Date.now()}`,
      from: 'You',
      to: thread.messages[thread.messages.length - 1]?.from || '',
      date: new Date().toLocaleString(getActiveLocale()),
      subject,
      body: replyHtml,
      attachments: []
    };
    const nextThread = {
      ...thread,
      messages: [...thread.messages, optimistic]
    };
    if (target === 'playlist') {
      this.playlistThread = nextThread;
      this.requestThreadScroll('playlist', true, 'smooth');
      return;
    }
    if (target === 'my-case') {
      this.myCaseThread = nextThread;
      this.requestThreadScroll('my-case', true, 'smooth');
      return;
    }
    this.openCaseThread = nextThread;
    this.requestThreadScroll('open', true, 'smooth');
  }

  private appendThreadMessage(target: ComposerTarget, message: GmailThreadMessage): void {
    const thread = target === 'playlist'
      ? this.playlistThread
      : (target === 'my-case' ? this.myCaseThread : this.openCaseThread);
    if (!thread) {
      this.reloadThread(target);
      return;
    }
    const nextThread = {
      ...thread,
      messages: [...thread.messages, message]
    };
    if (target === 'playlist') {
      this.playlistThread = nextThread;
      this.requestThreadScroll('playlist', true, 'smooth');
      return;
    }
    if (target === 'my-case') {
      this.myCaseThread = nextThread;
      this.requestThreadScroll('my-case', true, 'smooth');
      return;
    }
    this.openCaseThread = nextThread;
    this.requestThreadScroll('open', true, 'smooth');
  }

  private requestThreadScroll(target: ThreadScrollTarget, force: boolean, behavior: ScrollBehavior): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.pendingThreadScroll = { target, force, behavior };
  }

  private getThreadListElement(target: ThreadScrollTarget): HTMLElement | null {
    if (target === 'playlist') return this.playlistThreadList?.nativeElement ?? null;
    if (target === 'my-case') return this.myCaseThreadList?.nativeElement ?? null;
    if (target === 'open') return this.openThreadList?.nativeElement ?? null;
    return this.allCaseThreadList?.nativeElement ?? null;
  }

  private isNearBottom(el: HTMLElement, thresholdPx = 42): boolean {
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    return distance <= thresholdPx;
  }

  private reloadThread(target: ComposerTarget): void {
    if (target === 'playlist') {
      this.loadPlaylistThread();
      return;
    }
    if (target === 'my-case') {
      this.loadMyCaseThread();
      return;
    }
    this.loadOpenCaseThread();
  }

  isInternalNoteMessage(message: GmailThreadMessage | null | undefined): boolean {
    return !!message?.internalNote;
  }

  messageAuthorLabel(
    message: GmailThreadMessage,
    customerEmail?: string | null,
    customerName?: string | null
  ): string {
    if (this.isInternalNoteMessage(message)) {
      return message.from || 'Internal Note';
    }
    if (this.isOwnMessage(message.from, message.to, customerEmail, customerName)) {
      return 'You';
    }
    if (this.isCustomerMessage(message.from, message.to, customerEmail, customerName)) {
      return customerName || 'Customer';
    }
    return message.from;
  }

  isOwnMessage(from: string, to?: string | null, customerEmail?: string | null, customerName?: string | null): boolean {
    return this.resolveMessageActor(from, to, customerEmail, customerName) === 'own';
  }

  isCustomerMessage(from: string, to?: string | null, customerEmail?: string | null, customerName?: string | null): boolean {
    return this.resolveMessageActor(from, to, customerEmail, customerName) === 'customer';
  }

  private resolveMessageActor(
    from: string,
    to?: string | null,
    customerEmail?: string | null,
    customerName?: string | null
  ): 'own' | 'customer' | 'other' {
    const rawFrom = (from || '').toLowerCase().trim();
    const rawTo = (to || '').toLowerCase().trim();
    const rawCustomerName = (customerName || '').toLowerCase().trim();

    if (!rawFrom) {
      return 'other';
    }

    const fromEmail = this.extractEmail(rawFrom);
    const toEmail = this.extractEmail(rawTo);
    const me = this.extractEmail(this.userEmail);
    const customer = this.extractEmail((customerEmail || '').toLowerCase().trim());
    const toContainsCustomer = !!customer && (!!toEmail && toEmail === customer || rawTo.includes(customer));
    const fromContainsCustomer = !!customer && (!!fromEmail && fromEmail === customer || rawFrom.includes(customer));

    // Customer side always wins when sender clearly matches customer identity.
    if (fromContainsCustomer) {
      return 'customer';
    }

    // Some providers return "You" on incoming snippets; disambiguate using recipient.
    if (rawFrom === 'you' || rawFrom.startsWith('you ')) {
      return toContainsCustomer ? 'own' : (customer ? 'customer' : 'own');
    }

    // Agent direct address.
    if (fromEmail && me && fromEmail === me) {
      return 'own';
    }
    if (me && rawFrom.includes(me)) {
      return 'own';
    }

    // Shared support mailbox replying to customer.
    if (toContainsCustomer && (!fromEmail || fromEmail !== customer)) {
      return 'own';
    }

    // If sender email is explicit and not customer/me, keep neutral.
    if (fromEmail) {
      if (customer && fromEmail === customer) {
        return 'customer';
      }
      return 'other';
    }

    // Name-based fallback.
    if (rawCustomerName && rawCustomerName.length >= 3 && rawFrom.includes(rawCustomerName)) {
      return 'customer';
    }

    return 'other';
  }

  private extractEmail(value: string): string {
    const v = (value || '').toLowerCase().trim();
    if (!v) {
      return '';
    }
    const match = v.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return match ? match[0].toLowerCase() : '';
  }

  formatEmailHeaderDate(raw: string | null | undefined): string {
    const value = (raw || '').trim();
    if (!value) return '';

    // Gmail returns RFC 2822 dates with an explicit offset. We display the user's local time.
    // Internal notes use "yyyy-MM-dd HH:mm" which isn't reliably parseable; keep as-is.
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      return value;
    }

    const dt = new Date(parsed);
    const tz = (this.authService.getTimeZone() || '').trim();
    return dt.toLocaleString(getActiveLocale(), {
      ...(tz ? { timeZone: tz } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatBytes(bytes: number | null | undefined): string {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes)) {
      return '-';
    }

    const b = Math.max(0, bytes);
    if (b < 1024) {
      return `${b} B`;
    }

    const units = ['KB', 'MB', 'GB', 'TB'];
    let val = b / 1024;
    let u = 0;
    while (val >= 1024 && u < units.length - 1) {
      val /= 1024;
      u++;
    }

    const num = val >= 10 ? val.toFixed(0) : val.toFixed(1);
    return `${num} ${units[u]}`;
  }

  shortMime(mimeType: string | null | undefined): string {
    const m = (mimeType || '').trim().toLowerCase();
    if (!m) {
      return 'file';
    }

    if (m.startsWith('image/')) {
      const subtype = (m.split('/')[1] || 'img').split(';')[0];
      return subtype.toUpperCase().slice(0, 6);
    }
    if (m === 'application/pdf') {
      return 'PDF';
    }

    if (m.startsWith('text/')) {
      const subtype = (m.split('/')[1] || 'text').split(';')[0];
      return subtype.toUpperCase().slice(0, 6);
    }

    const parts = m.split('/');
    if (parts.length === 2) {
      const subtype = parts[1].split(';')[0];
      const simplified = subtype
        .replace('vnd.openxmlformats-officedocument.', '')
        .replace('vnd.ms-', '')
        .replace('vnd.', '');
      const last = simplified.split('.').pop() || simplified;
      return last.toUpperCase().slice(0, 8);
    }

    return m.toUpperCase().slice(0, 8);
  }

  attachmentKind(att: GmailThreadAttachment | null | undefined): string {
    const mime = (att?.mimeType || '').toLowerCase();
    const ext = this.attachmentExt(att?.filename);

    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'img';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (mime.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
    if (mime.includes('word') || ['doc', 'docx'].includes(ext)) return 'doc';
    if (mime.includes('sheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'xls';
    if (mime.includes('presentation') || mime.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) return 'ppt';
    if (mime.startsWith('text/') || ['txt', 'md', 'log', 'rtf'].includes(ext)) return 'txt';

    return 'file';
  }

  attachmentBadge(att: GmailThreadAttachment | null | undefined): string {
    const kind = this.attachmentKind(att);
    if (kind === 'img') return 'IMG';
    if (kind === 'pdf') return 'PDF';
    if (kind === 'zip') return 'ZIP';
    if (kind === 'doc') return 'DOC';
    if (kind === 'xls') return 'XLS';
    if (kind === 'ppt') return 'PPT';
    if (kind === 'txt') return 'TXT';

    const ext = this.attachmentExt(att?.filename);
    return ext ? ext.toUpperCase().slice(0, 4) : 'FILE';
  }

  private attachmentExt(filename: string | null | undefined): string {
    const name = (filename || '').trim().toLowerCase();
    const idx = name.lastIndexOf('.');
    if (idx <= 0 || idx >= name.length - 1) return '';
    return name.substring(idx + 1);
  }

  private refreshThreadWithRetry(target: ComposerTarget): void {
    const delays = [900, 1800, 3200];
    delays.forEach((delay) => {
      setTimeout(() => {
        if (target === 'playlist') {
          this.loadPlaylistThread();
        } else if (target === 'my-case') {
          this.loadMyCaseThread();
        } else {
          this.loadOpenCaseThread();
        }
      }, delay);
    });
  }

  private refreshMyCasesSnapshot(preferredTicketId: number): void {
    if (!this.userId) {
      return;
    }
    setTimeout(() => {
      this.crmService.getAllCases()
        .pipe(timeout(8000))
        .subscribe({
          next: (data) => {
            this.myCases = data.filter(c => c.assignedUserId === this.userId);
            this.selectedMyCase = this.myCases.find(t => t.id === preferredTicketId) || this.myCases[0] || null;
            this.syncTagSelectionFromCase(this.selectedMyCase);
            this.myCaseStatus = this.selectedMyCase?.status || this.myCaseStatus;
            this.loadMyCaseThread();
          },
          error: () => {}
        });
    }, 250);
  }

  private refreshPlaylistSnapshot(): void {
    if (!this.userId) {
      return;
    }
    setTimeout(() => {
      this.crmService.getMyPlaylist(this.userId)
        .pipe(timeout(8000))
        .subscribe({
          next: (data) => {
            this.myPlaylist = data;
            this.syncTagSelectionFromCase(data.oldestCase);
            this.playlistStatus = data.oldestCase?.status || this.playlistStatus;
            this.loadPlaylistThread();
          },
          error: () => {}
        });
    }, 250);
  }

  private refreshOpenCasesSnapshot(preferredTicketId: number): void {
    if (!this.userId) {
      return;
    }
    setTimeout(() => {
      this.crmService.getOpenCases(this.userId)
        .pipe(timeout(8000))
        .subscribe({
          next: (data) => {
            this.openCaseQueues = data;
            const flat = data.flatMap(queue => queue.tickets);
            this.selectedOpenCase = flat.find(t => t.id === preferredTicketId) || flat[0] || null;
            this.syncTagSelectionFromCase(this.selectedOpenCase);
            this.openCaseStatus = this.selectedOpenCase?.status || this.openCaseStatus;
            this.loadOpenCaseThread();
          },
          error: () => {}
        });
    }, 250);
  }

  private startAllCasesAutoSync(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.isTicketRoute) {
      return;
    }
    if (this.allCasesAutoSyncTimer) {
      clearInterval(this.allCasesAutoSyncTimer);
    }
    this.allCasesAutoSyncTimer = setInterval(() => {
      if (this.selectedChoice !== 'all-cases' || this.loading || this.syncing || !this.userId) {
        return;
      }
      this.loadAllCases(true);
    }, 5000);
  }

  private stopAllCasesAutoSync(): void {
    if (this.allCasesAutoSyncTimer) {
      clearInterval(this.allCasesAutoSyncTimer);
      this.allCasesAutoSyncTimer = null;
    }
  }
}




