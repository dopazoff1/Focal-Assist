import { CommonModule } from '@angular/common';
import { AfterViewChecked, ApplicationRef, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import {
  AssistantConversation,
  AssistantMessage,
  ProcessAssistantRole,
  ProcessAssistantService,
  PromptProfile
} from '../../services/process-assistant';
import { getActiveLocale } from '../../utils/locale';
import { markdownToSafeHtml } from '../../utils/markdown';

@Component({
  selector: 'app-process-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './process-assistant.html',
  styleUrls: ['./process-assistant.css']
})
export class ProcessAssistantComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesViewport') messagesViewport?: ElementRef<HTMLDivElement>;

  loading = true;
  sending = false;
  creatingConversation = false;

  statusMessage = '';
  errorMessage = '';

  conversations: AssistantConversation[] = [];
  messages: AssistantMessage[] = [];
  promptProfiles: PromptProfile[] = [];

  selectedConversationId: string | null = null;
  selectedPromptProfileId: number | null = null;

  draftMessage = '';

  private shouldScrollToBottom = false;

  constructor(
    public auth: AuthService,
    private processAssistant: ProcessAssistantService,
    private cdr: ChangeDetectorRef,
    private appRef: ApplicationRef
  ) {}

  get normalizedRole(): ProcessAssistantRole {
    const role = this.auth.getNormalizedRole();
    if (role === 'ADMIN' || role === 'TEAM_LEADER' || role === 'QA' || role === 'HEAD_CS' || role === 'OPS') {
      return role;
    }
    return 'AGENT';
  }

  get currentUserId(): number {
    const id = Number(this.auth.getUser()?.id || localStorage.getItem('id') || 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  get selectedConversation(): AssistantConversation | undefined {
    return this.conversations.find(c => c.id === this.selectedConversationId);
  }

  get selectedPromptProfile(): PromptProfile | undefined {
    return this.promptProfiles.find(p => p.id === this.selectedPromptProfileId);
  }

  get canSend(): boolean {
    return !!this.draftMessage.trim() && !this.sending && !this.loading;
  }

  ngOnInit(): void {
    void this.initialize();
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScrollToBottom) return;
    this.scrollToBottom();
    this.shouldScrollToBottom = false;
  }

  async initialize(): Promise<void> {
    if (this.currentUserId <= 0) {
      this.errorMessage = 'User session is invalid. Please log in again.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.statusMessage = 'Loading assistant workspace...';

    try {
      await this.reloadPromptProfiles();
      await this.reloadConversations();
      this.statusMessage = 'Assistant ready.';
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to load assistant workspace.';
    } finally {
      this.loading = false;
      this.requestUiRefresh();
    }
  }

  async reloadPromptProfiles(): Promise<void> {
    this.promptProfiles = await this.processAssistant.listPromptProfilesForRole(this.normalizedRole);
    if (!this.promptProfiles.some(p => p.id === this.selectedPromptProfileId)) {
      this.selectedPromptProfileId = this.promptProfiles[0]?.id ?? null;
    }
    this.requestUiRefresh();
  }

  async reloadConversations(): Promise<void> {
    this.conversations = await this.processAssistant.listConversations(this.currentUserId);
    if (!this.conversations.length) {
      const created = await this.processAssistant.createConversation(this.currentUserId, this.selectedPromptProfileId);
      this.conversations = [created];
    }

    if (!this.conversations.some(c => c.id === this.selectedConversationId)) {
      this.selectedConversationId = this.conversations[0]?.id ?? null;
    }

    if (this.selectedConversationId) {
      const selected = this.conversations.find(c => c.id === this.selectedConversationId);
      if (selected?.promptProfileId != null) {
        this.selectedPromptProfileId = selected.promptProfileId;
      }
      await this.loadConversationMessages(this.selectedConversationId);
    } else {
      this.messages = [];
    }
    this.requestUiRefresh();
  }

  async createNewConversation(): Promise<void> {
    if (this.creatingConversation) return;
    this.creatingConversation = true;
    this.errorMessage = '';
    this.statusMessage = 'Creating conversation...';

    try {
      const promptProfileId = this.selectedPromptProfileId ?? this.promptProfiles[0]?.id ?? null;
      if (this.selectedPromptProfileId == null && promptProfileId != null) {
        this.selectedPromptProfileId = promptProfileId;
      }
      const conversation = await this.processAssistant.createConversation(this.currentUserId, promptProfileId);
      this.conversations = await this.processAssistant.listConversations(this.currentUserId);
      this.selectedConversationId = conversation.id;
      this.messages = [];
      this.statusMessage = 'New conversation created.';
      this.shouldScrollToBottom = true;
      this.requestUiRefresh();
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to create conversation.';
      this.requestUiRefresh();
    } finally {
      this.creatingConversation = false;
      this.requestUiRefresh();
    }
  }

  async selectConversation(conversationId: string): Promise<void> {
    if (!conversationId) return;
    this.selectedConversationId = conversationId;
    this.errorMessage = '';
    const selected = this.conversations.find(c => c.id === conversationId);
    if (selected?.promptProfileId != null) {
      this.selectedPromptProfileId = selected.promptProfileId;
    }
    await this.loadConversationMessages(conversationId);
    this.requestUiRefresh();
  }

  async deleteConversation(conversationId: string, event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (!conversationId) return;
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Delete this conversation history?')
      : true;
    if (!confirmed) return;

    await this.processAssistant.deleteConversation(this.currentUserId, conversationId);
    this.conversations = await this.processAssistant.listConversations(this.currentUserId);

    if (!this.conversations.length) {
      const created = await this.processAssistant.createConversation(this.currentUserId, this.selectedPromptProfileId);
      this.conversations = [created];
    }

    this.selectedConversationId = this.conversations[0]?.id ?? null;
    if (this.selectedConversationId) {
      await this.loadConversationMessages(this.selectedConversationId);
    } else {
      this.messages = [];
    }
    this.statusMessage = 'Conversation deleted.';
    this.requestUiRefresh();
  }

  async onPromptProfileChanged(): Promise<void> {
    if (!this.selectedConversationId) return;
    await this.processAssistant.setConversationPrompt(
      this.currentUserId,
      this.selectedConversationId,
      this.selectedPromptProfileId
    );
    this.conversations = await this.processAssistant.listConversations(this.currentUserId);
    this.statusMessage = 'Prompt profile updated for this conversation.';
    this.requestUiRefresh();
  }

  async sendMessage(): Promise<void> {
    const text = this.draftMessage.trim();
    if (!text || this.sending || this.loading) return;
    const promptProfileId = this.selectedPromptProfileId ?? this.promptProfiles[0]?.id ?? null;
    if (this.selectedPromptProfileId == null && promptProfileId != null) {
      this.selectedPromptProfileId = promptProfileId;
    }

    if (!this.selectedConversationId) {
      await this.createNewConversation();
      if (!this.selectedConversationId) {
        this.errorMessage = 'Unable to create a conversation.';
        return;
      }
    }

    this.sending = true;
    this.errorMessage = '';
    this.statusMessage = 'Generating response...';
    this.draftMessage = '';
    this.shouldScrollToBottom = true;

    try {
      const result = await this.processAssistant.sendMessage({
        userId: this.currentUserId,
        role: this.normalizedRole,
        conversationId: this.selectedConversationId,
        text,
        promptProfileId
      });

      this.selectedConversationId = result.conversation.id;
      this.messages = result.messages;
      this.conversations = await this.processAssistant.listConversations(this.currentUserId);
      this.statusMessage = 'Response ready.';
      this.shouldScrollToBottom = true;
      this.requestUiRefresh();
    } catch (error: unknown) {
      const rawMessage = (error as Error)?.message || 'Assistant failed to respond.';
      if (rawMessage.includes('OpenAI API key is not configured on backend')) {
        this.errorMessage =
          'No AI key is configured for this prompt. Set the API key in Prompt Map Builder (for this prompt) or configure backend `openai.api-key`.';
      } else if (rawMessage.includes('Configured OpenAI API key format is invalid')) {
        this.errorMessage =
          'The API key saved on this prompt is not valid. Open Prompt Map Builder and set a real OpenAI key (starts with `sk-`).';
      } else {
        this.errorMessage = rawMessage;
      }

      // Keep UI in sync even when AI response fails: user message is already persisted.
      if (this.selectedConversationId) {
        const currentId = this.selectedConversationId;
        this.conversations = await this.processAssistant.listConversations(this.currentUserId);
        await this.loadConversationMessages(currentId);
        this.shouldScrollToBottom = true;
      }
      this.draftMessage = text;
      this.requestUiRefresh();
    } finally {
      this.sending = false;
      this.requestUiRefresh();
    }
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.canSend) {
        void this.sendMessage();
      }
    }
  }

  renderMessage(message: AssistantMessage): string {
    if (message.role === 'assistant' || message.role === 'system') {
      return markdownToSafeHtml(message.content || '');
    }
    return this.escapeHtml(message.content).replace(/\n/g, '<br/>');
  }

  roleLabel(message: AssistantMessage): string {
    if (message.role === 'assistant') return 'Focal Copilot';
    if (message.role === 'system') return 'System';
    return 'You';
  }

  formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(getActiveLocale(), {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  trackConversation(_: number, item: AssistantConversation): string {
    return item.id;
  }

  trackMessage(_: number, item: AssistantMessage): string {
    return item.id;
  }

  private async loadConversationMessages(conversationId: string): Promise<void> {
    this.messages = await this.processAssistant.getConversationMessages(this.currentUserId, conversationId);
    this.shouldScrollToBottom = true;
    this.requestUiRefresh();
  }

  private scrollToBottom(): void {
    const host = this.messagesViewport?.nativeElement;
    if (!host) return;
    host.scrollTop = host.scrollHeight;
  }

  private escapeHtml(raw: string): string {
    return (raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private requestUiRefresh(): void {
    // Keep UI responsive even if this helper is called during lifecycle edge-cases.
    try {
      this.cdr?.markForCheck?.();
      this.cdr?.detectChanges?.();
    } catch {
      // No-op: avoid throwing from UI refresh helper.
    }
    try {
      this.appRef?.tick?.();
    } catch {
      // No-op: avoid throwing from UI refresh helper.
    }
  }
}
