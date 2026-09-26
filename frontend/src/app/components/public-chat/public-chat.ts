import { CommonModule } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { LiveChatBundle, LiveChatMessage, LiveChatPlatformService, LiveChatSession } from '../../services/live-chat-platform';

@Component({
  selector: 'app-public-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './public-chat.html',
  styleUrls: ['./public-chat.css']
})
export class PublicChatComponent implements OnInit, OnDestroy {
  slug = '';
  project: any;
  token = '';
  session?: LiveChatSession;
  messages: LiveChatMessage[] = [];
  customerName = '';
  customerEmail = '';
  body = '';
  csatRating = 0;
  csatComment = '';
  csatSubmitted = false;
  csatSending = false;
  started = false;
  loading = true;
  sending = false;
  error = '';
  private sub?: Subscription;
  private tempMessageId = -1;

  constructor(
    private route: ActivatedRoute,
    private chat: LiveChatPlatformService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.activatePublicMode();
    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    if (this.isBrowser()) {
      const saved = localStorage.getItem(`public-chat:${this.slug}`);
      if (saved) {
        this.token = saved;
        this.started = true;
      }
      this.sub = this.chat.watchEvents().subscribe(event => {
        if (event.payload?.session?.publicToken === this.token) {
          this.applyBundle(event.payload);
        }
      });
    }
    void this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.isBrowser()) {
      document.body.classList.remove('public-chat-mode');
    }
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.project = await firstValueFrom(this.chat.getPublicProject(this.slug));
      if (this.started && this.token) {
        try {
          this.applyBundle(await firstValueFrom(this.chat.getPublicSession(this.token)));
        } catch {
          this.resetConversation(false);
        }
        if (this.isBrowser()) this.chat.connectSocket();
      }
      this.error = '';
    } catch (err: any) {
      this.error = err?.error?.message || 'Chat project not available.';
    } finally {
      this.loading = false;
    }
  }

  start(): void {
    this.chat.startPublicSession(this.slug, {
      customerName: this.customerName,
      customerEmail: this.customerEmail
    }).subscribe({
      next: bundle => {
        this.started = true;
        this.csatRating = 0;
        this.csatComment = '';
        this.csatSubmitted = false;
        this.token = bundle.session.publicToken;
        if (this.isBrowser()) localStorage.setItem(`public-chat:${this.slug}`, this.token);
        this.applyBundle(bundle);
        this.chat.connectSocket(bundle.session.id);
      },
      error: err => this.error = err?.error?.message || 'Could not start chat.'
    });
  }

  send(): void {
    if (!this.token || this.isClosed() || !this.body.trim()) return;
    const text = this.body.trim();
    this.body = '';
    this.sending = true;
    this.appendOptimisticMessage(text);
    this.chat.sendPublicMessage(this.token, text).subscribe({
      next: bundle => this.applyBundle(bundle),
      error: err => {
        this.messages = this.messages.filter(message => !(message.id < 0 && message.body === text));
        this.body = text;
        this.error = err?.error?.message || 'Message failed.';
      },
      complete: () => this.sending = false
    });
  }

  sendQuickReply(text: string): void {
    if (!text || this.sending || this.isClosed()) return;
    this.body = text;
    this.send();
  }

  quickReplies(): string[] {
    if (this.isClosed()) return [];
    const last = [...this.messages].reverse().find(message => message.senderType === 'BOT');
    if (!last?.metadataJson) return [];
    try {
      const meta = JSON.parse(last.metadataJson);
      const options = Array.isArray(meta?.options) ? meta.options : [];
      return options.map((option: unknown) => String(option).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  applyBundle(bundle: LiveChatBundle): void {
    this.session = bundle.session;
    this.messages = bundle.messages || [];
    this.csatSubmitted = this.messages.some(message => this.isCsatMessage(message));
    if (!this.isBrowser()) return;
    window.setTimeout(() => {
      const thread = document.querySelector('.public-chat-thread');
      if (thread) thread.scrollTop = thread.scrollHeight;
    }, 25);
  }

  isClosed(): boolean {
    return this.session?.status === 'CLOSED';
  }

  submitCsat(): void {
    if (!this.token || !this.isClosed() || !this.csatRating || this.csatSubmitted || this.csatSending) return;
    this.csatSending = true;
    this.chat.submitPublicCsat(this.token, this.csatRating, this.csatComment).subscribe({
      next: bundle => {
        this.applyBundle(bundle);
        this.csatSubmitted = true;
      },
      error: err => this.error = err?.error?.message || 'Could not submit feedback.',
      complete: () => this.csatSending = false
    });
  }

  startNewChat(): void {
    this.resetConversation(true);
  }

  private appendOptimisticMessage(body: string): void {
    this.messages = [
      ...this.messages,
      {
        id: this.tempMessageId--,
        sessionId: 0,
        senderType: 'CUSTOMER',
        senderName: 'You',
        body,
        createdAt: new Date().toISOString()
      }
    ];
    if (!this.isBrowser()) return;
    window.setTimeout(() => {
      const thread = document.querySelector('.public-chat-thread');
      if (thread) thread.scrollTop = thread.scrollHeight;
    }, 0);
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private activatePublicMode(): void {
    if (!this.isBrowser()) return;
    document.body.classList.remove('v2-mode', 'v3-mode', 'login-v3-mode', 'marketing-v3-mode');
    document.body.classList.add('public-chat-mode');
  }

  private resetConversation(keepCustomer = true): void {
    if (this.isBrowser()) {
      localStorage.removeItem(`public-chat:${this.slug}`);
    }
    this.token = '';
    this.session = undefined;
    this.messages = [];
    this.body = '';
    this.started = false;
    this.sending = false;
    this.csatRating = 0;
    this.csatComment = '';
    this.csatSubmitted = false;
    this.csatSending = false;
    if (!keepCustomer) {
      this.customerName = '';
      this.customerEmail = '';
    }
  }

  private isCsatMessage(message: LiveChatMessage): boolean {
    if (!message?.metadataJson) return false;
    try {
      return JSON.parse(message.metadataJson)?.type === 'CSAT';
    } catch {
      return message.metadataJson.includes('"type":"CSAT"');
    }
  }
}
