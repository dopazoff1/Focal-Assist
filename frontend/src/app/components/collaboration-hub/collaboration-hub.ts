import { CommonModule } from '@angular/common';
import { AfterViewChecked, ApplicationRef, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth';
import {
  CollaborationChannel,
  CollaborationCurrentUser,
  CollaborationDirectRoom,
  CollaborationMessage,
  CollaborationRoom,
  CollaborationService,
  CollaborationUser,
  CollaborationWorkspaceView
} from '../../services/collaboration';
import { KbArticle, KbService } from '../../services/kb';
import { getActiveLocale } from '../../utils/locale';

@Component({
  selector: 'app-collaboration-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './collaboration-hub.html',
  styleUrls: ['./collaboration-hub.css']
})
export class CollaborationHubComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('timelineViewport') timelineViewport?: ElementRef<HTMLDivElement>;

  loading = true;
  saving = false;
  errorMessage = '';
  statusMessage = '';

  workspace: CollaborationWorkspaceView | null = null;
  roomMessages: CollaborationMessage[] = [];
  selectedRoomId = '';
  threadRootMessageId: string | null = null;
  shouldScrollBottom = false;
  unreadDividerCutoffByRoom: Record<string, string> = {};
  unreadDividerMessageIdByRoom: Record<string, string> = {};
  hasCompletedInitialRoomLoad = false;
  typingUserIds: number[] = [];
  typingPulseTimestamp = 0;
  typingPollHandle: ReturnType<typeof setInterval> | null = null;
  typingStopHandle: ReturnType<typeof setTimeout> | null = null;

  searchTerm = '';
  roomFilter = '';
  composerDraft = '';
  composerLinkedArticleIds: number[] = [];
  emojiPalette = ['👍', '✅', '🔥', '🎯', '👀', '💡', '🚀'];

  showCreateChannel = false;
  showCreateDirect = false;
  newChannelName = '';
  newChannelDescription = '';
  newChannelTopic = '';
  newChannelPrivate = false;
  newChannelMemberIds: number[] = [];
  selectedDirectUserId: number | null = null;
  selectedInviteUserId: number | null = null;

  topicDraft = '';
  selectedRoomArticleId: number | null = null;

  editingMessageId: string | null = null;
  editingDraft = '';

  kbArticles: KbArticle[] = [];
  kbArticleById: Record<number, KbArticle> = {};
  private storeUpdateSubscription?: Subscription;
  private syncingFromStoreUpdate = false;

  constructor(
    public auth: AuthService,
    private collaboration: CollaborationService,
    private kbService: KbService,
    private cdr: ChangeDetectorRef,
    private appRef: ApplicationRef
  ) {}

  get currentUserId(): number {
    const parsed = Number(this.auth.getUser()?.id || localStorage.getItem('id') || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  get currentUserContext(): CollaborationCurrentUser {
    return {
      id: this.currentUserId,
      fullName: this.auth.getUserName() || 'Current User',
      email: (this.auth.getUser()?.email || localStorage.getItem('email') || '').toString(),
      role: this.auth.getNormalizedRole() || 'AGENT',
      status: this.auth.getUserStatus() || 'ONLINE'
    };
  }

  get users(): CollaborationUser[] {
    return this.workspace?.users || [];
  }

  get channels(): CollaborationChannel[] {
    const rooms = this.workspace?.channels || [];
    const q = this.roomFilter.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(room =>
      room.name.toLowerCase().includes(q) ||
      room.description.toLowerCase().includes(q) ||
      room.topic.toLowerCase().includes(q)
    );
  }

  get directs(): CollaborationDirectRoom[] {
    const rooms = this.workspace?.directs || [];
    const q = this.roomFilter.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(room => this.directRoomName(room).toLowerCase().includes(q));
  }

  get activeRoom(): CollaborationRoom | null {
    const all = this.workspace?.rooms || [];
    return all.find(room => room.id === this.selectedRoomId) || null;
  }

  get activeRoomIsChannel(): boolean {
    return this.activeRoom?.kind === 'CHANNEL';
  }

  get activeRoomIsDirect(): boolean {
    return this.activeRoom?.kind === 'DIRECT';
  }

  get activeChannel(): CollaborationChannel | null {
    const room = this.activeRoom;
    return room && room.kind === 'CHANNEL' ? room : null;
  }

  get activeRoomMessages(): CollaborationMessage[] {
    const q = this.searchTerm.trim().toLowerCase();
    const topLevel = this.roomMessages.filter(message => !message.parentId);
    if (!q) return topLevel;
    return topLevel.filter(message =>
      message.content.toLowerCase().includes(q) ||
      this.senderLabel(message.senderId).toLowerCase().includes(q)
    );
  }

  get activeThreadRoot(): CollaborationMessage | null {
    if (!this.activeRoomIsChannel) return null;
    if (!this.threadRootMessageId) return null;
    return this.roomMessages.find(message => message.id === this.threadRootMessageId) || null;
  }

  get activeThreadMessages(): CollaborationMessage[] {
    if (!this.activeRoomIsChannel) return [];
    if (!this.threadRootMessageId) return [];
    return this.roomMessages
      .filter(message => message.parentId === this.threadRootMessageId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get typingUsers(): CollaborationUser[] {
    if (!this.typingUserIds.length) return [];
    return this.typingUserIds
      .map(id => this.users.find(user => user.id === id))
      .filter((user): user is CollaborationUser => !!user);
  }

  get typingLine(): string {
    const names = this.typingUsers.map(user => user.name.trim()).filter(Boolean);
    if (!names.length) return '';
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing`;
  }

  get pinnedMessages(): CollaborationMessage[] {
    return this.roomMessages
      .filter(message => message.pinned)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get roomLinkedArticles(): KbArticle[] {
    const room = this.activeRoom;
    if (!room) return [];
    return room.linkedArticleIds
      .map(id => this.kbArticleById[id])
      .filter((article): article is KbArticle => !!article);
  }

  get mentionInbox(): CollaborationMessage[] {
    return this.workspace?.mentionInbox || [];
  }

  get savedMessages(): CollaborationMessage[] {
    return this.workspace?.savedMessages || [];
  }

  get preferences() {
    return this.workspace?.preferences || null;
  }

  get canSend(): boolean {
    return !!this.composerDraft.trim() && !!this.selectedRoomId && !this.saving;
  }

  get canCreateChannel(): boolean {
    return this.canManageChannels && !!this.newChannelName.trim() && !this.saving;
  }

  get canManageChannels(): boolean {
    return this.currentUserContext.role === 'ADMIN';
  }

  get mentionCandidates(): CollaborationUser[] {
    return this.users
      .filter(user => user.id !== this.currentUserId && user.active)
      .slice(0, 6);
  }

  get roomCreationCandidates(): CollaborationUser[] {
    return this.users.filter(user => user.id !== this.currentUserId && user.active);
  }

  get inviteCandidates(): CollaborationUser[] {
    const channel = this.activeChannel;
    if (!channel) return [];
    const members = new Set(channel.memberIds);
    return this.users.filter(user => user.id !== this.currentUserId && user.active && !members.has(user.id));
  }

  get availableKBAttachments(): KbArticle[] {
    return this.kbArticles.filter(article => !this.composerLinkedArticleIds.includes(article.id)).slice(0, 60);
  }

  ngOnInit(): void {
    this.bindStoreUpdates();
    void this.initialize();
  }

  ngOnDestroy(): void {
    this.storeUpdateSubscription?.unsubscribe();
    this.stopTypingPolling();
    this.clearTypingStopTimer();
    if (this.selectedRoomId) {
      void this.collaboration.setTyping(this.currentUserContext, this.selectedRoomId, false).catch(() => {});
    }
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScrollBottom) return;
    this.scrollToBottom();
    this.shouldScrollBottom = false;
  }

  async initialize(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.statusMessage = 'Booting collaboration workspace...';

    try {
      await this.loadKbArticles();
      await this.reloadWorkspace();
      this.statusMessage = 'Collaboration Hub ready.';
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to initialize collaboration workspace.';
    } finally {
      this.loading = false;
      this.requestUiRefresh();
    }
  }

  async reloadWorkspace(keepRoom = true): Promise<void> {
    const previousRoom = keepRoom ? this.selectedRoomId : '';
    this.workspace = await this.collaboration.getWorkspace(this.currentUserContext);

    if (previousRoom && this.workspace.rooms.some(room => room.id === previousRoom)) {
      this.selectedRoomId = previousRoom;
    } else {
      this.selectedRoomId = this.workspace.rooms[0]?.id || '';
    }
    await this.refreshRoomMessages(true);
    this.requestUiRefresh();
  }

  async openRoom(roomId: string): Promise<void> {
    if (!roomId || roomId === this.selectedRoomId) return;
    const previousRoomId = this.selectedRoomId;
    if (previousRoomId) {
      await this.collaboration.setTyping(this.currentUserContext, previousRoomId, false).catch(() => {});
    }
    this.selectedRoomId = roomId;
    this.threadRootMessageId = null;
    this.searchTerm = '';
    this.editingMessageId = null;
    this.editingDraft = '';
    this.composerLinkedArticleIds = [];
    this.typingUserIds = [];
    this.clearTypingStopTimer();
    this.typingPulseTimestamp = 0;
    await this.refreshRoomMessages(true);
  }

  async refreshRoomMessages(markAsRead: boolean): Promise<void> {
    if (!this.selectedRoomId) {
      this.roomMessages = [];
      this.topicDraft = '';
      this.requestUiRefresh();
      return;
    }

    const roomId = this.selectedRoomId;
    const previousLastReadAt = (this.workspace?.preferences?.lastReadAtByRoom?.[roomId] || '').trim();
    const unreadBefore = Number(this.workspace?.unreadByRoom?.[roomId] || 0);

    this.roomMessages = await this.collaboration.getRoomMessages(this.currentUserContext, roomId);
    const channel = this.activeChannel;
    this.topicDraft = channel?.topic || '';
    if (!this.activeRoomIsChannel) {
      this.threadRootMessageId = null;
    }

    if (markAsRead) {
      if (this.hasCompletedInitialRoomLoad) {
        if (unreadBefore > 0) {
          this.unreadDividerCutoffByRoom[roomId] = previousLastReadAt;
        } else {
          delete this.unreadDividerCutoffByRoom[roomId];
        }
      } else {
        // Do not keep divider after browser refresh / first room hydration.
        delete this.unreadDividerCutoffByRoom[roomId];
        this.hasCompletedInitialRoomLoad = true;
      }
    }
    this.recomputeUnreadDividerMessage(roomId);

    if (markAsRead) {
      await this.collaboration.markRoomRead(this.currentUserContext, roomId);
      this.workspace = await this.collaboration.getWorkspace(this.currentUserContext);
    }
    this.startTypingPolling();
    this.shouldScrollBottom = true;
    this.requestUiRefresh();
  }

  async sendMessage(): Promise<void> {
    if (!this.canSend || !this.selectedRoomId) return;
    const text = this.composerDraft.trim();
    if (!text) return;

    this.saving = true;
    this.errorMessage = '';
    try {
      await this.collaboration.sendMessage(
        this.currentUserContext,
        this.selectedRoomId,
        text,
        {
          parentId: this.activeRoomIsChannel ? this.threadRootMessageId : null,
          linkedArticleIds: this.composerLinkedArticleIds
        }
      );
      await this.collaboration.setTyping(this.currentUserContext, this.selectedRoomId, false).catch(() => {});
      this.composerDraft = '';
      this.composerLinkedArticleIds = [];
      this.typingPulseTimestamp = 0;
      this.clearTypingStopTimer();
      await this.reloadWorkspace();
      this.threadRootMessageId = this.threadRootMessageId;
      this.shouldScrollBottom = true;
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to send message.';
    } finally {
      this.saving = false;
      this.requestUiRefresh();
    }
  }

  async createChannel(): Promise<void> {
    if (!this.canCreateChannel) return;
    this.saving = true;
    this.errorMessage = '';
    try {
      const created = await this.collaboration.createChannel(this.currentUserContext, {
        name: this.newChannelName,
        description: this.newChannelDescription,
        topic: this.newChannelTopic,
        isPrivate: this.newChannelPrivate,
        memberIds: this.newChannelMemberIds
      });
      this.resetChannelForm();
      this.showCreateChannel = false;
      this.selectedRoomId = created.id;
      await this.reloadWorkspace();
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to create channel.';
    } finally {
      this.saving = false;
      this.requestUiRefresh();
    }
  }

  async createDirectRoom(): Promise<void> {
    if (!this.selectedDirectUserId || this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    try {
      const room = await this.collaboration.createDirectRoom(this.currentUserContext, this.selectedDirectUserId);
      this.showCreateDirect = false;
      this.selectedDirectUserId = null;
      this.selectedRoomId = room.id;
      await this.reloadWorkspace();
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to create direct room.';
    } finally {
      this.saving = false;
      this.requestUiRefresh();
    }
  }

  async inviteUserToActiveChannel(): Promise<void> {
    const channel = this.activeChannel;
    const userId = Number(this.selectedInviteUserId || 0);
    if (!channel || !this.canManageChannels || !Number.isFinite(userId) || userId <= 0 || this.saving) return;

    this.saving = true;
    this.errorMessage = '';
    try {
      const invited = await this.collaboration.inviteChannelMembers(this.currentUserContext, channel.id, [userId]);
      if (invited.length > 0) {
        this.statusMessage = 'Channel invitation sent.';
      } else {
        this.statusMessage = 'User is already in this channel.';
      }
      this.selectedInviteUserId = null;
      await this.reloadWorkspace();
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to invite user to channel.';
    } finally {
      this.saving = false;
      this.requestUiRefresh();
    }
  }

  async saveRoomTopic(): Promise<void> {
    if (!this.activeChannel || this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    try {
      await this.collaboration.setRoomTopic(this.currentUserContext, this.activeChannel.id, this.topicDraft);
      await this.reloadWorkspace();
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to update topic.';
    } finally {
      this.saving = false;
      this.requestUiRefresh();
    }
  }

  async addArticleToRoom(): Promise<void> {
    const room = this.activeRoom;
    const articleId = Number(this.selectedRoomArticleId || 0);
    if (!room || !Number.isFinite(articleId) || articleId <= 0 || this.saving) return;

    const next = [...new Set([...room.linkedArticleIds, articleId])];
    this.saving = true;
    this.errorMessage = '';
    try {
      await this.collaboration.setRoomLinkedArticles(this.currentUserContext, room.id, next);
      this.selectedRoomArticleId = null;
      await this.reloadWorkspace();
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to link article to room.';
    } finally {
      this.saving = false;
      this.requestUiRefresh();
    }
  }

  async removeArticleFromRoom(articleId: number): Promise<void> {
    const room = this.activeRoom;
    if (!room || this.saving) return;
    const next = room.linkedArticleIds.filter(id => id !== articleId);
    this.saving = true;
    try {
      await this.collaboration.setRoomLinkedArticles(this.currentUserContext, room.id, next);
      await this.reloadWorkspace();
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to unlink article.';
    } finally {
      this.saving = false;
      this.requestUiRefresh();
    }
  }

  async toggleRoomStar(room: CollaborationRoom, event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    await this.collaboration.toggleRoomStar(this.currentUserContext, room.id);
    this.workspace = await this.collaboration.getWorkspace(this.currentUserContext);
    this.requestUiRefresh();
  }

  async toggleRoomMute(room: CollaborationRoom): Promise<void> {
    await this.collaboration.toggleRoomMute(this.currentUserContext, room.id);
    this.workspace = await this.collaboration.getWorkspace(this.currentUserContext);
    this.requestUiRefresh();
  }

  openThread(message: CollaborationMessage): void {
    if (!this.activeRoomIsChannel) return;
    this.threadRootMessageId = message.id;
  }

  closeThread(): void {
    this.threadRootMessageId = null;
  }

  threadReplyCount(rootMessageId: string): number {
    return this.roomMessages.filter(message => message.parentId === rootMessageId).length;
  }

  async toggleReaction(message: CollaborationMessage, emoji: string): Promise<void> {
    if (!this.selectedRoomId) return;
    await this.collaboration.toggleReaction(this.currentUserContext, this.selectedRoomId, message.id, emoji);
    await this.refreshRoomMessages(false);
  }

  async togglePin(message: CollaborationMessage): Promise<void> {
    if (!this.selectedRoomId) return;
    await this.collaboration.togglePinMessage(this.currentUserContext, this.selectedRoomId, message.id);
    await this.refreshRoomMessages(false);
    this.workspace = await this.collaboration.getWorkspace(this.currentUserContext);
    this.requestUiRefresh();
  }

  async toggleSaveMessage(message: CollaborationMessage): Promise<void> {
    if (!this.selectedRoomId) return;
    await this.collaboration.toggleSaveMessage(this.currentUserContext, this.selectedRoomId, message.id);
    this.workspace = await this.collaboration.getWorkspace(this.currentUserContext);
    this.requestUiRefresh();
  }

  isMessageSaved(messageId: string): boolean {
    return !!this.workspace?.preferences.savedMessageIds.includes(messageId);
  }

  isRoomStarred(roomId: string): boolean {
    return !!this.workspace?.preferences.starredRoomIds.includes(roomId);
  }

  isRoomMuted(roomId: string): boolean {
    return !!this.workspace?.preferences.mutedRoomIds.includes(roomId);
  }

  unreadCount(roomId: string): number {
    return Number(this.workspace?.unreadByRoom[roomId] || 0);
  }

  startEditing(message: CollaborationMessage): void {
    if (!this.isOwnMessage(message) || message.kind !== 'USER') return;
    this.editingMessageId = message.id;
    this.editingDraft = message.content;
  }

  cancelEditing(): void {
    this.editingMessageId = null;
    this.editingDraft = '';
  }

  async saveEditing(message: CollaborationMessage): Promise<void> {
    if (!this.selectedRoomId || this.editingMessageId !== message.id) return;
    const content = this.editingDraft.trim();
    if (!content) return;
    this.saving = true;
    try {
      await this.collaboration.editMessage(this.currentUserContext, this.selectedRoomId, message.id, content);
      this.cancelEditing();
      await this.refreshRoomMessages(false);
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to edit message.';
    } finally {
      this.saving = false;
      this.requestUiRefresh();
    }
  }

  async deleteMessage(message: CollaborationMessage): Promise<void> {
    if (!this.selectedRoomId) return;
    const confirmed = typeof window === 'undefined' ? true : window.confirm('Delete this message and its thread replies?');
    if (!confirmed) return;
    this.saving = true;
    try {
      await this.collaboration.deleteMessage(this.currentUserContext, this.selectedRoomId, message.id);
      if (this.threadRootMessageId === message.id) {
        this.threadRootMessageId = null;
      }
      await this.refreshRoomMessages(false);
      this.workspace = await this.collaboration.getWorkspace(this.currentUserContext);
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to delete message.';
    } finally {
      this.saving = false;
      this.requestUiRefresh();
    }
  }

  appendMention(handle: string): void {
    const token = `@${handle}`;
    if (this.composerDraft.includes(token)) return;
    const spacer = this.composerDraft.trim().length > 0 ? ' ' : '';
    this.composerDraft = `${this.composerDraft}${spacer}${token} `;
  }

  addArticleToComposer(articleId: number): void {
    const id = Number(articleId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!this.composerLinkedArticleIds.includes(id)) {
      this.composerLinkedArticleIds = [...this.composerLinkedArticleIds, id];
    }
  }

  removeComposerArticle(articleId: number): void {
    this.composerLinkedArticleIds = this.composerLinkedArticleIds.filter(id => id !== articleId);
  }

  onComposerDraftChanged(): void {
    if (!this.selectedRoomId) return;
    const hasDraft = !!this.composerDraft.trim();
    if (!hasDraft) {
      this.typingPulseTimestamp = 0;
      this.clearTypingStopTimer();
      void this.collaboration.setTyping(this.currentUserContext, this.selectedRoomId, false).catch(() => {});
      return;
    }

    const now = Date.now();
    if (now - this.typingPulseTimestamp >= 2400) {
      this.typingPulseTimestamp = now;
      void this.collaboration.setTyping(this.currentUserContext, this.selectedRoomId, true).catch(() => {});
    }

    this.clearTypingStopTimer();
    this.typingStopHandle = setTimeout(() => {
      if (!this.selectedRoomId) return;
      this.typingPulseTimestamp = 0;
      void this.collaboration.setTyping(this.currentUserContext, this.selectedRoomId, false).catch(() => {});
    }, 1800);
  }

  directDeliveryLabel(message: CollaborationMessage): string {
    if (!this.activeRoomIsDirect) return '';
    if (!this.isOwnMessage(message)) return '';
    if (message.kind !== 'USER') return '';
    return message.deliveryState === 'SEEN' ? 'Seen' : 'Sent';
  }

  directRoomName(room: CollaborationDirectRoom): string {
    const peerId = room.memberIds.find(id => id !== this.currentUserId);
    if (!peerId) return 'Direct Message';
    const user = this.users.find(item => item.id === peerId);
    return user?.name || `User ${peerId}`;
  }

  senderLabel(senderId: number): string {
    if (senderId === this.currentUserId) return 'You';
    const user = this.users.find(item => item.id === senderId);
    return user?.name || `User ${senderId}`;
  }

  senderHandle(senderId: number): string {
    const user = this.users.find(item => item.id === senderId);
    return user?.handle || `user.${senderId}`;
  }

  senderStatus(senderId: number): string {
    const user = this.users.find(item => item.id === senderId);
    return user?.status || 'OFFLINE';
  }

  formatRoomTitle(room: CollaborationRoom): string {
    if (room.kind === 'CHANNEL') {
      return `#${room.name}`;
    }
    return this.directRoomName(room);
  }

  formatMessageTime(iso: string): string {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '';
    return new Intl.DateTimeFormat(getActiveLocale(), {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(parsed);
  }

  isOwnMessage(message: CollaborationMessage): boolean {
    return message.senderId === this.currentUserId;
  }

  isRootMessage(message: CollaborationMessage): boolean {
    return !message.parentId;
  }

  reactionSummary(message: CollaborationMessage): Array<{ emoji: string; users: number[] }> {
    return Object.entries(message.reactions).map(([emoji, users]) => ({ emoji, users }));
  }

  currentUserReacted(message: CollaborationMessage, emoji: string): boolean {
    const users = message.reactions[emoji] || [];
    return users.includes(this.currentUserId);
  }

  messageLinkedArticles(message: CollaborationMessage): KbArticle[] {
    return message.linkedArticleIds
      .map(id => this.kbArticleById[id])
      .filter((article): article is KbArticle => !!article);
  }

  renderMessage(content: string): string {
    const escaped = this.escapeHtml(content).replace(/\n/g, '<br/>');
    return escaped.replace(/@([a-zA-Z0-9._-]+)/g, '<span class="mention">@$1</span>');
  }

  trackRoom(_: number, room: CollaborationRoom): string {
    return room.id;
  }

  trackMessage(_: number, message: CollaborationMessage): string {
    return message.id;
  }

  isUnreadDividerMessage(message: CollaborationMessage): boolean {
    if (!this.selectedRoomId) return false;
    return this.unreadDividerMessageIdByRoom[this.selectedRoomId] === message.id;
  }

  private async loadKbArticles(): Promise<void> {
    try {
      const articles = await firstValueFrom(this.kbService.getAllArticles());
      this.kbArticles = (Array.isArray(articles) ? articles : [])
        .filter(article => article.isActive !== false)
        .sort((a, b) => a.title.localeCompare(b.title));
      this.kbArticleById = {};
      for (const article of this.kbArticles) {
        this.kbArticleById[article.id] = article;
      }
    } catch {
      this.kbArticles = [];
      this.kbArticleById = {};
    }
  }

  private resetChannelForm(): void {
    this.newChannelName = '';
    this.newChannelDescription = '';
    this.newChannelTopic = '';
    this.newChannelPrivate = false;
    this.newChannelMemberIds = [];
  }

  toggleChannelMember(userId: number): void {
    if (this.newChannelMemberIds.includes(userId)) {
      this.newChannelMemberIds = this.newChannelMemberIds.filter(id => id !== userId);
    } else {
      this.newChannelMemberIds = [...this.newChannelMemberIds, userId];
    }
  }

  private bindStoreUpdates(): void {
    this.storeUpdateSubscription?.unsubscribe();
    this.storeUpdateSubscription = this.collaboration.watchStoreUpdates().subscribe(() => {
      void this.syncFromStoreUpdate();
    });
  }

  private async syncFromStoreUpdate(): Promise<void> {
    if (this.loading || this.saving || this.syncingFromStoreUpdate) return;
    this.syncingFromStoreUpdate = true;
    try {
      await this.reloadWorkspace();
    } catch {
      // Ignore live-sync failures to avoid interrupting user actions.
    } finally {
      this.syncingFromStoreUpdate = false;
      this.requestUiRefresh();
    }
  }

  private scrollToBottom(): void {
    const host = this.timelineViewport?.nativeElement;
    if (!host) return;
    host.scrollTop = host.scrollHeight;
  }

  private requestUiRefresh(): void {
    try {
      this.cdr?.markForCheck?.();
      this.cdr?.detectChanges?.();
    } catch {
      // No-op to avoid lifecycle edge-case exceptions.
    }
    try {
      this.appRef?.tick?.();
    } catch {
      // No-op to avoid lifecycle edge-case exceptions.
    }
  }

  private escapeHtml(raw: string): string {
    return (raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private startTypingPolling(): void {
    this.stopTypingPolling();
    if (!this.selectedRoomId) return;

    const poll = async () => {
      if (!this.selectedRoomId) {
        this.typingUserIds = [];
        return;
      }
      try {
        const typing = await this.collaboration.getTyping(this.currentUserContext, this.selectedRoomId);
        this.typingUserIds = Array.isArray(typing?.typingUserIds) ? typing.typingUserIds : [];
      } catch {
        this.typingUserIds = [];
      } finally {
        this.requestUiRefresh();
      }
    };

    void poll();
    this.typingPollHandle = setInterval(() => {
      void poll();
    }, 1800);
  }

  private stopTypingPolling(): void {
    if (!this.typingPollHandle) return;
    clearInterval(this.typingPollHandle);
    this.typingPollHandle = null;
  }

  private clearTypingStopTimer(): void {
    if (!this.typingStopHandle) return;
    clearTimeout(this.typingStopHandle);
    this.typingStopHandle = null;
  }

  private recomputeUnreadDividerMessage(roomId: string): void {
    const cutoff = this.unreadDividerCutoffByRoom[roomId];
    if (cutoff === undefined) {
      delete this.unreadDividerMessageIdByRoom[roomId];
      return;
    }

    const topLevel = this.roomMessages.filter(message => !message.parentId);
    const firstUnread = topLevel.find(message => !cutoff || message.createdAt > cutoff);
    if (!firstUnread) {
      delete this.unreadDividerMessageIdByRoom[roomId];
      return;
    }
    this.unreadDividerMessageIdByRoom[roomId] = firstUnread.id;
  }
}
