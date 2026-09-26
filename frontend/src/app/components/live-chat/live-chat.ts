import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, firstValueFrom } from 'rxjs';
import {
  ChatProject,
  LiveChatBundle,
  LiveChatMessage,
  LiveChatPlatformService,
  LiveChatSession
} from '../../services/live-chat-platform';

@Component({
  selector: 'app-live-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './live-chat.html',
  styleUrls: ['./live-chat.css']
})
export class LiveChatComponent implements OnInit, OnDestroy {
  projects: ChatProject[] = [];
  sessions: LiveChatSession[] = [];
  selected?: LiveChatSession;
  messages: LiveChatMessage[] = [];
  composer = '';
  loading = false;
  sending = false;
  filters: { projectId?: number; status?: string } = {};
  notice = '';
  private sub?: Subscription;
  private tempMessageId = -1;

  constructor(private chat: LiveChatPlatformService) {}

  ngOnInit(): void {
    this.chat.connectSocket();
    this.sub = this.chat.watchEvents().subscribe(event => {
      if (!event?.type) return;
      this.upsertSession(event.payload?.session);
      if (this.selected && event.sessionId === this.selected.id) {
        this.applyBundle(event.payload);
      }
    });
    void this.initialize();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async initialize(): Promise<void> {
    this.projects = await firstValueFrom(this.chat.listProjects());
    await this.reloadSessions(true);
  }

  async reloadSessions(selectFirst = false): Promise<void> {
    this.loading = true;
    try {
      this.sessions = await firstValueFrom(this.chat.listSessions(this.filters));
      if (this.selected) {
        const fresh = this.sessions.find(session => session.id === this.selected?.id);
        if (fresh) this.selected = fresh;
      } else if (selectFirst && this.sessions.length) {
        await this.selectSession(this.sessions[0]);
      }
    } finally {
      this.loading = false;
    }
  }

  async selectSession(session: LiveChatSession): Promise<void> {
    this.selected = session;
    this.messages = await firstValueFrom(this.chat.getMessages(session.id));
    this.chat.connectSocket(session.id);
    window.setTimeout(() => this.scrollToBottom(), 30);
  }

  claimNext(): void {
    this.chat.claimNext(this.filters.projectId).subscribe({
      next: bundle => {
        this.applyBundle(bundle);
        this.selected = bundle.session;
        void this.reloadSessions(false);
        this.flash('Next waiting chat assigned.');
      },
      error: err => this.flash(err?.error?.message || 'No waiting chats available.')
    });
  }

  send(): void {
    if (!this.selected || !this.composer.trim()) return;
    const body = this.composer.trim();
    this.composer = '';
    this.sending = true;
    this.appendOptimisticMessage('AGENT', body);
    this.chat.sendAgentMessage(this.selected.id, body).subscribe({
      next: bundle => this.applyBundle(bundle),
      error: err => {
        this.removeOptimisticMessage(body);
        this.composer = body;
        this.flash(err?.error?.message || 'Message failed.');
      },
      complete: () => this.sending = false
    });
  }

  close(): void {
    if (!this.selected) return;
    this.chat.closeSession(this.selected.id).subscribe({
      next: bundle => {
        this.applyBundle(bundle);
        void this.reloadSessions(false);
      }
    });
  }

  applyBundle(bundle?: LiveChatBundle): void {
    if (!bundle?.session) return;
    this.selected = bundle.session;
    this.upsertSession(bundle.session);
    this.messages = bundle.messages || this.messages;
    window.setTimeout(() => this.scrollToBottom(), 30);
  }

  statusClass(status?: string): string {
    return (status || '').toLowerCase().replaceAll('_', '-');
  }

  private scrollToBottom(): void {
    const el = document.querySelector('.live-chat-thread');
    if (el) el.scrollTop = el.scrollHeight;
  }

  private appendOptimisticMessage(senderType: LiveChatMessage['senderType'], body: string): void {
    if (!this.selected) return;
    this.messages = [
      ...this.messages,
      {
        id: this.tempMessageId--,
        sessionId: this.selected.id,
        senderType,
        senderName: 'You',
        body,
        createdAt: new Date().toISOString()
      }
    ];
    this.selected = {
      ...this.selected,
      lastMessagePreview: body
    };
    this.upsertSession(this.selected);
    window.setTimeout(() => this.scrollToBottom(), 0);
  }

  private removeOptimisticMessage(body: string): void {
    this.messages = this.messages.filter(message => !(message.id < 0 && message.body === body));
  }

  private upsertSession(session?: LiveChatSession): void {
    if (!session || !this.matchesFilters(session)) return;
    const exists = this.sessions.some(item => item.id === session.id);
    this.sessions = exists
      ? this.sessions.map(item => item.id === session.id ? session : item)
      : [session, ...this.sessions];
  }

  private matchesFilters(session: LiveChatSession): boolean {
    if (this.filters.projectId && session.projectId !== this.filters.projectId) return false;
    if (this.filters.status && session.status !== this.filters.status) return false;
    return true;
  }

  private flash(text: string): void {
    this.notice = text;
    window.setTimeout(() => {
      if (this.notice === text) this.notice = '';
    }, 4200);
  }
}
