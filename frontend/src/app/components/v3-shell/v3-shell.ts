import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideActivity,
  LucideBarChart3,
  LucideBookOpen,
  LucideBot,
  LucideCalendarDays,
  LucideChartNoAxesCombined,
  LucideClipboardCheck,
  LucideClock3,
  LucideFileText,
  LucideGamepad2,
  LucideGauge,
  LucideGraduationCap,
  LucideInbox,
  LucideKanban,
  LucideKanbanSquare,
  LucideKeyRound,
  LucideLanguages,
  LucideLayoutDashboard,
  LucideLibrary,
  LucideLogOut,
  LucideMap,
  LucideMenu,
  LucideMessageCircle,
  LucideMessagesSquare,
  LucideMoon,
  LucidePanelTop,
  LucidePanelLeftClose,
  LucideRotateCcw,
  LucideRotateCw,
  LucideSave,
  LucideSearch,
  LucideSettings,
  LucideShieldCheck,
  LucideSiren,
  LucideSparkles,
  LucideSun,
  LucideTags,
  LucideTrash2,
  LucideUpload,
  LucideUserRoundCog,
  LucideUsers,
  LucideWandSparkles,
  LucideWorkflow,
  LucideX
} from '@lucide/angular';
import { finalize, firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth';
import { CollaborationCurrentUser, CollaborationService } from '../../services/collaboration';
import { I18nPipe } from '../../pipes/i18n.pipe';
import { I18nService } from '../../services/i18n';
import { PresenceService } from '../../services/presence';
import { MeSettings, SettingsService } from '../../services/settings';
import { UI_LANGUAGE_OPTIONS, UiLanguage } from '../../utils/locale';
import { AccessControlService } from '../../services/access-control';
import { VisibleMotion } from '../../directives/visible-motion';
import { ThemeService } from '../../services/theme';
import { LoginV2Game } from '../login-v2/login-v2-game';

const GAME_TRIGGER_WORD = 'kiwikiwikiwikiwi';

@Component({
  selector: 'app-v3-shell',
  standalone: true,
  imports: [
    VisibleMotion,
    LoginV2Game,
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    I18nPipe,
    LucideActivity,
    LucideBarChart3,
    LucideBookOpen,
    LucideBot,
    LucideCalendarDays,
    LucideChartNoAxesCombined,
    LucideClipboardCheck,
    LucideClock3,
    LucideFileText,
    LucideGamepad2,
    LucideGauge,
    LucideGraduationCap,
    LucideInbox,
    LucideKanban,
    LucideKanbanSquare,
    LucideKeyRound,
    LucideLanguages,
    LucideLayoutDashboard,
    LucideLibrary,
    LucideLogOut,
    LucideMap,
    LucideMenu,
    LucideMessageCircle,
    LucideMessagesSquare,
    LucideMoon,
    LucidePanelTop,
    LucidePanelLeftClose,
    LucideRotateCcw,
    LucideRotateCw,
    LucideSave,
    LucideSearch,
    LucideSettings,
    LucideShieldCheck,
    LucideSiren,
    LucideSparkles,
    LucideSun,
    LucideTags,
    LucideTrash2,
    LucideUpload,
    LucideUserRoundCog,
    LucideUsers,
    LucideWandSparkles,
    LucideWorkflow,
    LucideX
  ],
  templateUrl: './v3-shell.html',
  styleUrls: [
    './v3-shell.css',
    './v3-shell-topbar.css',
    './v3-shell-modal.css',
    './v3-shell-responsive.css'
  ]
})
export class V3Shell implements OnInit, OnDestroy, AfterViewInit {
  readonly fallbackStatuses = ['ONLINE', 'AWAY', 'WRAPUP', 'BREAK', 'OFFLINE'];
  availableStatuses: string[] = [...this.fallbackStatuses];
  selectedStatus = 'OFFLINE';
  statusSaving = false;

  timeZones: string[] = [];
  selectedTimeZone = '';
  timeZoneSaving = false;
  languageOptions = UI_LANGUAGE_OPTIONS;
  selectedLanguage: UiLanguage = 'en';
  uiScaleMode: 'COMPACT' | 'CLASSIC' = 'CLASSIC';

  sidebarOpen = false;
  sidebarCollapsed = false;
  narrowViewport = false;
  quickSearch = '';
  pageTitle = 'Command Center';
  pageKicker = 'Workspace';
  compactCenterContent = false;
  workspaceEntering = false;
  isSignalSprintOpen = false;

  @ViewChild('contentHost') contentHost?: ElementRef<HTMLElement>;
  @ViewChild('profilePhotoInput') profilePhotoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('profileCropCanvas') profileCropCanvas?: ElementRef<HTMLCanvasElement>;

  private routerSub?: Subscription;
  private collaborationUnreadSub?: Subscription;
  private languageSub?: Subscription;
  private routeAnimFrame?: number;
  private routeAnimation?: Animation;
  private workspaceEntryTimer?: number;
  private focusReturn?: HTMLElement;
  private lastPath = '';
  private shouldAnimateCurrentNav = false;
  collaborationUnreadCount = 0;
  private lastCollaborationUnreadCount: number | null = null;
  private audioContext: AudioContext | null = null;
  private typedWord = '';

  profilePhotoUrl = '';
  profilePhotoLoading = false;
  profilePhotoSaving = false;
  showProfilePhotoEditor = false;
  cropZoom = 1;
  cropRotation = 0;
  cropOffsetX = 0;
  cropOffsetY = 0;
  cropSourceImage: HTMLImageElement | null = null;
  private cropDragging = false;
  private cropDragStartX = 0;
  private cropDragStartY = 0;
  private cropOriginOffsetX = 0;
  private cropOriginOffsetY = 0;
  private readonly cropStageSize = 360;

  constructor(
    public auth: AuthService,
    public i18n: I18nService,
    private presenceService: PresenceService,
    private settingsService: SettingsService,
    private collaborationService: CollaborationService,
    private router: Router,
    private accessControl: AccessControlService,
    private themeService: ThemeService
  ) {}

  get isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  get canManageStaff(): boolean {
    return this.hasFeatureAccess('staff_management');
  }

  get canUseBuilders(): boolean {
    return this.hasFeatureAccess('builders');
  }

  get canManageArticles(): boolean {
    return this.hasFeatureAccess('article_management');
  }

  get canValidateArticles(): boolean {
    return this.hasFeatureAccess('kb_article_validation');
  }

  get canConfigureValidationChain(): boolean {
    return this.hasFeatureAccess('kb_validation_chain');
  }

  get canManageTeams(): boolean {
    return this.hasFeatureAccess('team_management');
  }

  get canManageChannelAccess(): boolean {
    return this.hasFeatureAccess('channel_access_map');
  }

  get canManageRoleAccessMap(): boolean {
    return this.hasFeatureAccess('role_access_map');
  }

  get canViewAdherence(): boolean {
    return this.hasFeatureAccess('adherence');
  }

  get canUseQaEvaluation(): boolean {
    return this.hasFeatureAccess('qa_evaluation');
  }

  get canUseFlowDesk(): boolean {
    return this.hasFeatureAccess('flowdesk');
  }

  get canUseCrm(): boolean {
    return this.canUseFlowDesk;
  }

  get canManageTraining(): boolean {
    return this.canUseAcademyStudio || this.canUseAcademyAnalytics;
  }

  get canUseProcessAssistant(): boolean {
    return this.hasFeatureAccess('process_assistant');
  }

  get canUseCollaboration(): boolean {
    return this.hasFeatureAccess('collaboration');
  }

  get canManageChatProjects(): boolean {
    return this.hasFeatureAccess('chat_projects');
  }

  get canUseLiveChat(): boolean {
    return this.hasFeatureAccess('live_chat');
  }

  get canUseCalendar(): boolean {
    return this.hasFeatureAccess('calendar');
  }

  get canUseCommandCenter(): boolean {
    return this.hasFeatureAccess('command_center');
  }

  get canUseUserSettings(): boolean {
    return this.hasFeatureAccess('user_settings');
  }

  get canUseMagicAssistance(): boolean {
    return this.hasFeatureAccess('magic_assistance');
  }

  get canUseKnowledgeBase(): boolean {
    return this.hasFeatureAccess('knowledge_base');
  }

  get canUseKnowledgeAnalytics(): boolean {
    return this.hasFeatureAccess('knowledge_analytics');
  }

  get canUseAcademy(): boolean {
    return this.canUseAcademyHome
      || this.canUseAcademyCatalog
      || this.canUseAcademyStudio
      || this.canUseAcademyAnalytics;
  }

  get canUseAcademyHome(): boolean {
    return this.hasFeatureAccess('academy_home');
  }

  get canUseAcademyCatalog(): boolean {
    return this.hasFeatureAccess('academy_catalog');
  }

  get canUseAcademyStudio(): boolean {
    return this.hasFeatureAccess('academy_studio');
  }

  get canUseAcademyAnalytics(): boolean {
    return this.hasFeatureAccess('academy_analytics');
  }

  get canManagePromptMap(): boolean {
    return this.hasFeatureAccess('prompt_map_builder');
  }

  get showBuildGroup(): boolean {
    return this.canUseBuilders || this.canManagePromptMap || this.canConfigureValidationChain;
  }

  get showManageGroup(): boolean {
    return this.canManageArticles
      || this.canValidateArticles
      || this.canManageTeams
      || this.canManageChannelAccess
      || this.canManageChatProjects
      || this.canManageRoleAccessMap
      || this.canUseQaEvaluation
      || this.canViewAdherence
      || this.canManageStaff;
  }

  get userInitials(): string {
    const full = (this.auth.getUserName() || '').trim();
    if (!full) return 'U';
    const parts = full.split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }

  get currentUserContext(): CollaborationCurrentUser {
    const user = this.auth.getUser();
    const parsedId = Number(user?.id || localStorage.getItem('id') || 0);
    return {
      id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0,
      fullName: this.auth.getUserName() || 'Current User',
      email: (user?.email || localStorage.getItem('email') || '').toString(),
      role: this.auth.getNormalizedRole() || 'AGENT',
      status: this.auth.getUserStatus() || 'ONLINE'
    };
  }

  ngOnInit(): void {
    this.updateViewport();
    if (typeof document !== 'undefined') {
      this.workspaceEntering = document.body.classList.contains('workspace-entering');
      document.body.classList.remove('workspace-entering');
      document.body.classList.remove('v2-mode');
      document.body.classList.add('v3-mode');
      // V3 uses its own scale class so it is not affected by V2 html-level zoom state.
      document.documentElement.classList.remove('ui-scale-compact');
      if (this.workspaceEntering && typeof window !== 'undefined') {
        this.workspaceEntryTimer = window.setTimeout(() => {
          this.workspaceEntering = false;
          this.workspaceEntryTimer = undefined;
        }, 1200);
      }
    }

    this.selectedStatus = this.auth.getUserStatus();
    this.accessControl.ensureLoaded().subscribe({
      next: () => {},
      error: () => {}
    });
    this.initUiScale();
    try {
      const savedCollapseState = localStorage.getItem('focal.navigation.collapsed')
        ?? localStorage.getItem('focal.navigation.collapsed');
      this.sidebarCollapsed = savedCollapseState === 'true';
    } catch { /* Storage can be unavailable. */ }
    this.initTimeZones();
    this.selectedLanguage = this.i18n.language;
    this.languageSub = this.i18n.language$.subscribe(() => {
      this.selectedLanguage = this.i18n.language;
      this.updateTitleFromUrl(this.router.url);
    });
    this.loadPresenceMeta();
    this.loadSettings();
    void this.reloadProfilePhoto();
    this.startUnreadMonitor();
    this.updateTitleFromUrl(this.router.url);
    this.lastPath = this.normalizePath(this.router.url);

    this.routerSub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        const nextPath = this.normalizePath(e.url || '');
        this.shouldAnimateCurrentNav = nextPath !== this.lastPath;
        return;
      }
      if (e instanceof NavigationEnd) {
        this.sidebarOpen = false;
        this.updateTitleFromUrl(e.urlAfterRedirects || e.url || '');
        const newPath = this.normalizePath(e.urlAfterRedirects || e.url || '');
        if (this.shouldAnimateCurrentNav || newPath !== this.lastPath) {
          this.restartRouteTransition();
        }
        this.lastPath = newPath;
        this.shouldAnimateCurrentNav = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.collaborationUnreadSub?.unsubscribe();
    this.languageSub?.unsubscribe();
    this.releaseProfilePhotoUrl();
    this.routeAnimation?.cancel();
    void this.audioContext?.close();
    if (this.routeAnimFrame !== undefined && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.routeAnimFrame);
    }
    if (this.workspaceEntryTimer !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(this.workspaceEntryTimer);
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('v3-mode');
      document.body.classList.remove('v3-ui-compact');
    }
  }

  ngAfterViewInit(): void {
    this.restartRouteTransition();
    this.labelNavigation();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleSidebarCollapse(): void {
    this.labelNavigation();
    this.sidebarCollapsed = !this.sidebarCollapsed;
    try { localStorage.setItem('focal.navigation.collapsed', String(this.sidebarCollapsed)); } catch { /* Session-only fallback. */ }
  }

  @HostListener('window:resize')
  updateViewport(): void {
    if (typeof window !== 'undefined') this.narrowViewport = window.matchMedia('(max-width: 980px)').matches;
  }

  private labelNavigation(): void {
    if (typeof document === 'undefined') return;
    document.querySelectorAll<HTMLAnchorElement>('.v3-nav a').forEach(link => {
      const label = link.querySelector('span:not(.v3-nav-badge)')?.textContent?.trim();
      if (label) link.title = label;
    });
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  logout(): void {
    this.auth.logout();
  }

  updateMyStatus(): void {
    const next = this.selectedStatus || 'OFFLINE';
    this.statusSaving = true;
    this.presenceService.updateMyStatus(next)
      .pipe(finalize(() => this.statusSaving = false))
      .subscribe({
        next: (me) => {
          this.selectedStatus = me.status || next;
          this.auth.setUserStatus(this.selectedStatus);
        },
        error: () => {
          this.selectedStatus = this.auth.getUserStatus();
        }
      });
  }

  updateMyTimeZone(): void {
    const tz = (this.selectedTimeZone || '').trim();
    this.timeZoneSaving = true;
    this.settingsService.updateTimeZone(tz)
      .pipe(finalize(() => this.timeZoneSaving = false))
      .subscribe({
        next: (res) => {
          this.selectedTimeZone = (res.timeZone || '').trim();
          this.auth.setTimeZone(this.selectedTimeZone);
        },
        error: () => {
          this.selectedTimeZone = this.auth.getTimeZone();
        }
      });
  }

  updateLanguage(): void {
    this.i18n.setLanguage(this.selectedLanguage);
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  openSignalSprintGame(): void {
    this.typedWord = '';
    this.isSignalSprintOpen = true;
  }

  closeSignalSprintGame(): void {
    this.typedWord = '';
    this.isSignalSprintOpen = false;
  }

  openSettings(): void {
    this.closeSidebar();
    void this.router.navigate(['/v3/settings']);
  }

  runQuickSearch(event?: Event): void {
    event?.preventDefault();
    const raw = (this.quickSearch || '').trim();
    if (!raw) return;

    void this.router.navigate(['/v3/knowledge-base'], { queryParams: { q: raw }, queryParamsHandling: 'merge' });
  }

  private loadPresenceMeta(): void {
    this.presenceService.getStatuses().subscribe({
      next: (statuses) => {
        if (Array.isArray(statuses) && statuses.length > 0) {
          this.availableStatuses = [...statuses].sort();
        }
      },
      error: () => {
        this.availableStatuses = [...this.fallbackStatuses];
      }
    });

    this.presenceService.getMe().subscribe({
      next: (me) => {
        this.selectedStatus = me.status || this.selectedStatus;
        this.auth.setUserStatus(this.selectedStatus);
      },
      error: () => {}
    });
  }

  private loadSettings(): void {
    this.settingsService.getMe().subscribe({
      next: (me) => {
        const tz = (me?.timeZone || '').toString().trim();
        this.selectedTimeZone = tz || this.auth.getTimeZone() || '';
        this.auth.setTimeZone(this.selectedTimeZone);
        this.auth.setProfilePhotoMeta(!!me?.hasProfilePhoto, (me?.profilePhotoUpdatedAt || '').toString());
        void this.reloadProfilePhoto();
      },
      error: () => {
        this.selectedTimeZone = this.auth.getTimeZone() || '';
      }
    });
  }

  private initTimeZones(): void {
    const resolved = typeof Intl !== 'undefined' && Intl.DateTimeFormat
      ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '')
      : '';

    const fallback = [
      'Africa/Casablanca',
      'Europe/Paris',
      'Europe/London',
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Asia/Dubai',
      'Asia/Riyadh'
    ];

    const list = [...new Set([resolved, ...fallback].filter(Boolean))];
    this.timeZones = list;
    this.selectedTimeZone = this.auth.getTimeZone() || resolved || '';
  }

  updateUiScale(): void {
    this.applyUiScale(this.uiScaleMode);
  }

  private initUiScale(): void {
    this.applyUiScale('CLASSIC');
  }

  private applyUiScale(mode: 'COMPACT' | 'CLASSIC'): void {
    if (typeof document === 'undefined') return;
    // UI mode is locked to CLASSIC.
    this.uiScaleMode = 'CLASSIC';
    document.body.classList.remove('v3-ui-compact');
  }

  private updateTitleFromUrl(url: string): void {
    const path = (url || '').split('?')[0];
    const parts = path.split('/').filter(Boolean);
    const last = parts.slice(0, 3).join('/'); // e.g. "v3/crm"

    const set = (kickerKey: string, titleKey: string) => {
      this.pageKicker = this.i18n.t(kickerKey);
      this.pageTitle = this.i18n.t(titleKey);
    };

    this.compactCenterContent = path === '/v3/home' || path === '/v3/magic-assistance';

    if (last === 'v3/home') return set('shell.kicker.workspace', 'shell.page.commandCenter');
    if (last === 'v3/calendar') return set('shell.kicker.workspace', 'shell.page.calendar');
    if (last === 'v3/crm') return set('shell.kicker.workspace', 'shell.page.crmInbox');
    if (last.startsWith('v3/crm')) return set('shell.kicker.workspace', 'shell.page.crmInbox');
    if (last === 'v3/magic-assistance') return set('shell.kicker.assist', 'shell.page.magicAssistance');
    if (last === 'v3/knowledge-base') return set('shell.kicker.knowledge', 'shell.page.knowledgeBase');
    if (path.startsWith('/v3/knowledge-hub/article/')) return set('shell.kicker.knowledge', 'shell.page.knowledgeHubArticle');
    if (last === 'v3/knowledge-hub/category') return set('shell.kicker.knowledge', 'shell.page.knowledgeHubCategory');
    if (last === 'v3/knowledge-hub') return set('shell.kicker.knowledge', 'shell.page.knowledgeHub');
    if (last === 'v3/kb-analytics') return set('shell.kicker.knowledge', 'shell.page.kbAnalytics');
    if (last === 'v3/collaboration') return set('shell.kicker.workspace', 'shell.page.collaborationHub');
    if (last === 'v3/chat-projects') return set('Chat Platform', 'Chat Projects');
    if (last === 'v3/live-chat') return set('Chat Platform', 'Live Chat');
    if (last === 'v3/process-assistant') return set('shell.kicker.assist', 'shell.page.processCopilot');
    if (last === 'v3/academy') return set('shell.kicker.academy', 'shell.page.myTrainings');
    if (last === 'v3/academy/catalog') return set('shell.kicker.academy', 'shell.page.trainingCatalog');
    if (path.startsWith('/v3/academy/studio/course')) return set('shell.kicker.academy', 'shell.page.courseEditor');
    if (path.startsWith('/v3/academy/course')) return set('shell.kicker.academy', 'shell.page.course');
    if (last === 'v3/academy/studio') return set('shell.kicker.academy', 'shell.page.trainingStudio');
    if (last === 'v3/academy/analytics') return set('shell.kicker.academy', 'shell.page.trainingAnalytics');
    if (last === 'v3/article-management') return set('shell.kicker.manage', 'shell.page.articleManagement');
    if (last.startsWith('v3/article-management')) return set('shell.kicker.manage', 'shell.page.articleEditor');
    if (last === 'v3/article-validation') return set('shell.kicker.manage', 'Article validation');
    if (last === 'v3/team-management') return set('shell.kicker.manage', 'shell.page.teamManagement');
    if (last === 'v3/channel-access-map') return set('shell.kicker.manage', 'shell.page.channelAccess');
    if (last === 'v3/role-access-map') return set('shell.kicker.manage', 'shell.page.roleAccessMap');
    if (last === 'v3/settings') return set('shell.kicker.manage', 'shell.page.userSettings');
    if (last === 'v3/staff-management') return set('shell.kicker.manage', 'shell.page.staffManagement');
    if (last === 'v3/qa-evaluation') return set('shell.kicker.quality', 'shell.page.qaEvaluation');
    if (last === 'v3/adherence-dashboard') return set('shell.kicker.ops', 'shell.page.adherenceDashboard');
    if (last === 'v3/tree-builder') return set('shell.kicker.build', 'shell.page.treeBuilder');
    if (last === 'v3/kb-map-builder') return set('shell.kicker.build', 'shell.page.kbMapBuilder');
    if (last === 'v3/article-validation-chain') return set('shell.kicker.build', 'Validation Chain Builder');
    if (last === 'v3/case-tag-builder') return set('shell.kicker.build', 'shell.page.caseTags');
    if (last === 'v3/prompt-map-builder') return set('shell.kicker.build', 'shell.page.promptMapBuilder');
    if (last === 'v3/flowdesk/escalations') return set('shell.kicker.delivery', 'shell.page.escalationDesk');
    if (last.startsWith('v3/flowdesk')) return set('shell.kicker.delivery', 'shell.page.flowDesk');
    if (last === 'v3/404') return set('shell.kicker.workspace', 'shell.page.notFound');
    if (last === 'v3/article-not-found') return set('shell.kicker.knowledge', 'shell.page.articleNotFound');

    set('shell.kicker.workspace', 'shell.page.focalAssist');
  }

  private hasFeatureAccess(featureKey: string): boolean {
    const role = this.auth.getNormalizedRole();
    return this.accessControl.hasFeatureAccess(role, featureKey);
  }

  private restartRouteTransition(): void {
    if (typeof window === 'undefined' || !this.contentHost?.nativeElement) return;
    this.routeAnimation?.cancel();
    if (this.routeAnimFrame !== undefined) {
      window.cancelAnimationFrame(this.routeAnimFrame);
      this.routeAnimFrame = undefined;
    }

    this.routeAnimFrame = window.requestAnimationFrame(() => {
      this.routeAnimFrame = undefined;
      const routedContent = this.getRoutedContentElement();
      if (!routedContent || typeof routedContent.animate !== 'function') return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduceMotion) return;
      this.routeAnimation = routedContent.animate(
        [
          { opacity: 0.92 },
          { opacity: 1 }
        ],
        {
          duration: 180,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'none'
        }
      );
    });
  }

  private getRoutedContentElement(): HTMLElement | null {
    const host = this.contentHost?.nativeElement;
    if (!host) return null;
    const candidates = Array.from(host.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.tagName !== 'ROUTER-OUTLET'
    );
    return candidates.length ? candidates[candidates.length - 1] : null;
  }

  onRouteActivate(): void {
    this.restartRouteTransition();
  }

  openProfilePhotoEditor(): void {
    this.focusReturn = document.activeElement as HTMLElement;
    this.showProfilePhotoEditor = true;
    queueMicrotask(() => document.querySelector<HTMLElement>('.v3-avatar-modal .close')?.focus());
  }

  closeProfilePhotoEditor(): void {
    this.showProfilePhotoEditor = false;
    this.focusReturn?.focus();
    this.cropSourceImage = null;
    this.cropDragging = false;
    this.cropZoom = 1;
    this.cropRotation = 0;
    this.cropOffsetX = 0;
    this.cropOffsetY = 0;
    const fileInput = this.profilePhotoInput?.nativeElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  chooseProfilePhotoFile(): void {
    this.profilePhotoInput?.nativeElement?.click();
  }

  @HostListener('document:keydown', ['$event'])
  onWorkspaceKey(event: KeyboardEvent): void {
    if (this.isSignalSprintOpen) return;
    if (event.key === 'Escape') {
      if (this.showProfilePhotoEditor) this.closeProfilePhotoEditor();
      else if (this.sidebarOpen) {
        this.closeSidebar();
        document.querySelector<HTMLElement>('.v3-burger')?.focus();
      }
    }
    const target = event.target as HTMLElement | null;
    const isFormField = !!target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    if (!isFormField && /^[a-z0-9]$/i.test(event.key)) {
      this.typedWord = `${this.typedWord}${event.key.toLowerCase()}`.slice(-GAME_TRIGGER_WORD.length);
      if (this.typedWord === GAME_TRIGGER_WORD) {
        event.preventDefault();
        this.openSignalSprintGame();
      }
      return;
    }
    if (!isFormField && event.key === 'Backspace') {
      this.typedWord = this.typedWord.slice(0, -1);
      return;
    }
    if (!isFormField && (event.key === ' ' || event.key === 'Enter')) this.typedWord = '';
    if (event.key !== 'Tab') return;
    const root = this.showProfilePhotoEditor
      ? document.querySelector('.v3-avatar-modal')
      : this.sidebarOpen ? document.querySelector('.v3-sidebar') : null;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length);
    const first = items[0], last = items[items.length - 1];
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  }

  async onProfilePhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    const image = await this.readImageFromFile(file).catch(() => null);
    if (!image) return;

    this.cropSourceImage = image;
    this.cropZoom = 1;
    this.cropRotation = 0;
    this.cropOffsetX = 0;
    this.cropOffsetY = 0;
    this.renderCropStage();
  }

  onCropZoomChange(): void {
    this.cropZoom = Math.max(1, Math.min(5, Number(this.cropZoom || 1)));
    this.renderCropStage();
  }

  rotateCrop(deltaDegrees: number): void {
    this.cropRotation = ((Number(this.cropRotation || 0) + Number(deltaDegrees || 0)) % 360 + 360) % 360;
    this.renderCropStage();
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.cropDragging) return;
    const dx = event.clientX - this.cropDragStartX;
    const dy = event.clientY - this.cropDragStartY;
    this.cropOffsetX = this.cropOriginOffsetX + dx;
    this.cropOffsetY = this.cropOriginOffsetY + dy;
    this.renderCropStage();
  }

  @HostListener('window:pointerup')
  onWindowPointerUp(): void {
    this.cropDragging = false;
  }

  onCropPointerDown(event: PointerEvent): void {
    if (!this.cropSourceImage) return;
    this.cropDragging = true;
    this.cropDragStartX = event.clientX;
    this.cropDragStartY = event.clientY;
    this.cropOriginOffsetX = this.cropOffsetX;
    this.cropOriginOffsetY = this.cropOffsetY;
    event.preventDefault();
  }

  async saveProfilePhoto(): Promise<void> {
    if (!this.cropSourceImage || this.profilePhotoSaving) return;
    this.profilePhotoSaving = true;
    try {
      const blob = await this.exportCroppedPhotoBlob(1024);
      if (!blob) return;
      const result = await firstValueFrom(this.settingsService.uploadMyProfilePhoto(blob));
      this.auth.setProfilePhotoMeta(!!result?.hasProfilePhoto, (result?.profilePhotoUpdatedAt || '').toString());
      await this.reloadProfilePhoto();
      this.closeProfilePhotoEditor();
    } finally {
      this.profilePhotoSaving = false;
    }
  }

  async removeProfilePhoto(): Promise<void> {
    if (this.profilePhotoSaving) return;
    this.profilePhotoSaving = true;
    try {
      const result = await firstValueFrom(this.settingsService.deleteMyProfilePhoto());
      this.auth.setProfilePhotoMeta(!!result?.hasProfilePhoto, (result?.profilePhotoUpdatedAt || '').toString());
      this.releaseProfilePhotoUrl();
      this.profilePhotoUrl = '';
      this.closeProfilePhotoEditor();
    } finally {
      this.profilePhotoSaving = false;
    }
  }

  private async reloadProfilePhoto(): Promise<void> {
    if (!this.auth.hasProfilePhoto()) {
      this.releaseProfilePhotoUrl();
      this.profilePhotoUrl = '';
      return;
    }
    this.profilePhotoLoading = true;
    try {
      const blob = await firstValueFrom(this.settingsService.getProfilePhoto('me', 'light'));
      this.releaseProfilePhotoUrl();
      this.profilePhotoUrl = URL.createObjectURL(blob);
    } catch {
      this.releaseProfilePhotoUrl();
      this.profilePhotoUrl = '';
    } finally {
      this.profilePhotoLoading = false;
    }
  }

  private releaseProfilePhotoUrl(): void {
    if (!this.profilePhotoUrl) return;
    try {
      URL.revokeObjectURL(this.profilePhotoUrl);
    } catch {
      // no-op
    }
    this.profilePhotoUrl = '';
  }

  private async readImageFromFile(file: File): Promise<HTMLImageElement> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to decode image'));
      image.src = dataUrl;
    });
  }

  private renderCropStage(): void {
    if (!this.profileCropCanvas?.nativeElement || !this.cropSourceImage) return;
    const canvas = this.profileCropCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const cropBackground = this.readDesignColor('--color-night');
    if (cropBackground) {
      ctx.fillStyle = cropBackground;
      ctx.fillRect(0, 0, width, height);
    }

    this.drawCroppedImage(ctx, width, height);
  }

  private drawCroppedImage(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.cropSourceImage) return;
    const image = this.cropSourceImage;
    const coverScale = Math.max(width / image.width, height / image.height);
    const scale = coverScale * Math.max(1, Number(this.cropZoom || 1));
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const rotation = Number(this.cropRotation || 0) * (Math.PI / 180);

    ctx.save();
    ctx.translate(width / 2 + this.cropOffsetX, height / 2 + this.cropOffsetY);
    ctx.rotate(rotation);
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }

  private async exportCroppedPhotoBlob(targetSize: number): Promise<Blob | null> {
    if (!this.cropSourceImage) return null;

    const stage = this.profileCropCanvas?.nativeElement;
    const output = document.createElement('canvas');
    output.width = targetSize;
    output.height = targetSize;
    const ctx = output.getContext('2d');
    if (!ctx) return null;

    const outputBackground = this.readDesignColor('--color-surface');
    if (outputBackground) {
      ctx.fillStyle = outputBackground;
      ctx.fillRect(0, 0, targetSize, targetSize);
    }

    const stageSize = stage ? stage.width : this.cropStageSize;
    const factor = targetSize / stageSize;
    const image = this.cropSourceImage;
    const coverScale = Math.max(stageSize / image.width, stageSize / image.height);
    const scale = coverScale * Math.max(1, Number(this.cropZoom || 1));
    const drawWidth = image.width * scale * factor;
    const drawHeight = image.height * scale * factor;
    const rotation = Number(this.cropRotation || 0) * (Math.PI / 180);

    ctx.save();
    ctx.translate(
      targetSize / 2 + this.cropOffsetX * factor,
      targetSize / 2 + this.cropOffsetY * factor
    );
    ctx.rotate(rotation);
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();

    return await new Promise<Blob | null>((resolve) => {
      output.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    });
  }

  private readDesignColor(token: string): string {
    if (typeof document === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  }

  private normalizePath(url: string): string {
    return (url || '').split('?')[0].split('#')[0];
  }


  private startUnreadMonitor(): void {
    if (!this.canUseCollaboration) return;
    this.collaborationUnreadSub?.unsubscribe();
    this.collaborationUnreadSub = this.collaborationService.watchStoreUpdates().subscribe(() => {
      void this.refreshCollaborationUnread();
    });
    void this.refreshCollaborationUnread();
  }

  private async refreshCollaborationUnread(): Promise<void> {
    if (!this.canUseCollaboration || !this.auth.isLoggedIn()) {
      this.collaborationUnreadCount = 0;
      this.lastCollaborationUnreadCount = null;
      return;
    }
    try {
      const workspace = await this.collaborationService.getWorkspace(this.currentUserContext);
      const unread = Object.values(workspace.unreadByRoom || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
      if (this.lastCollaborationUnreadCount !== null && unread > this.lastCollaborationUnreadCount) {
        this.playIncomingMessageSound();
      }
      this.lastCollaborationUnreadCount = unread;
      this.collaborationUnreadCount = unread;
    } catch {
      // Silent fail; unread badge can recover on next tick.
    }
  }

  private playIncomingMessageSound(): void {
    if (typeof window === 'undefined') return;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;

    try {
      if (!this.audioContext) {
        this.audioContext = new Ctor();
      }
      const ctx = this.audioContext;
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(720, now);
      oscillator.frequency.exponentialRampToValueAtTime(960, now + 0.07);
      oscillator.frequency.exponentialRampToValueAtTime(640, now + 0.16);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.24);
    } catch {
      // Ignore blocked audio playback.
    }
  }
}
