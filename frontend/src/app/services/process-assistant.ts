import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type ProcessAssistantRole =
  | 'AGENT'
  | 'ADMIN'
  | 'TEAM_LEADER'
  | 'QA'
  | 'HEAD_CS'
  | 'OPS';

export interface PromptProfile {
  id: number;
  name: string;
  systemPrompt: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  active: boolean;
  xPos: number;
  yPos: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromptRoleLink {
  role: ProcessAssistantRole;
  promptProfileId: number;
}

export interface PromptMapConfig {
  profiles: PromptProfile[];
  links: PromptRoleLink[];
}

export type AssistantMessageRole = 'user' | 'assistant' | 'system';

export interface AssistantConversation {
  id: string;
  userId: number;
  title: string;
  promptProfileId: number | null;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
  model?: string;
}

interface AssistantStore {
  promptProfiles: PromptProfile[];
  promptLinks: PromptRoleLink[];
  conversations: AssistantConversation[];
  messagesByConversation: Record<string, AssistantMessage[]>;
}

interface BackendAssistantResponse {
  content?: string;
  answer?: string;
  message?: string | { content?: string };
}

interface ChatCompletionMessage {
  role: AssistantMessageRole;
  content: string;
}

export interface AssistantSendRequest {
  userId: number;
  role: ProcessAssistantRole;
  conversationId: string;
  text: string;
  promptProfileId: number | null;
}

export interface AssistantSendResult {
  conversation: AssistantConversation;
  messages: AssistantMessage[];
}

interface BackendSendMessageResponse {
  conversation?: unknown;
  messages?: unknown[];
}

const SUPPORTED_ROLES: ProcessAssistantRole[] = [
  'AGENT',
  'ADMIN',
  'TEAM_LEADER',
  'QA',
  'HEAD_CS',
  'OPS'
];

const DEFAULT_STORE: AssistantStore = {
  promptProfiles: [
    {
      id: 1,
      name: 'Agent Process Coach',
      systemPrompt:
        'You are Focal Process Coach. Respond with practical, step-by-step guidance for support agents. Prioritize policy compliance, customer clarity, and concise actions.',
      model: 'gpt-4o-mini',
      apiKey: '',
      temperature: 0.2,
      maxTokens: 800,
      active: true,
      xPos: 560,
      yPos: 120,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      name: 'QA & TL Reviewer',
      systemPrompt:
        'You are Focal QA Reviewer. Evaluate process quality, identify risk, and provide corrective recommendations with clear acceptance criteria.',
      model: 'gpt-4o-mini',
      apiKey: '',
      temperature: 0.15,
      maxTokens: 900,
      active: true,
      xPos: 560,
      yPos: 330,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Operations Strategist',
      systemPrompt:
        'You are Focal Operations Strategist. Provide structured recommendations for planning, governance, staffing, SLA handling, and executive decision support.',
      model: 'gpt-4o-mini',
      apiKey: '',
      temperature: 0.1,
      maxTokens: 1000,
      active: true,
      xPos: 560,
      yPos: 540,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  promptLinks: [
    { role: 'AGENT', promptProfileId: 1 },
    { role: 'TEAM_LEADER', promptProfileId: 2 },
    { role: 'QA', promptProfileId: 2 },
    { role: 'ADMIN', promptProfileId: 3 },
    { role: 'HEAD_CS', promptProfileId: 3 },
    { role: 'OPS', promptProfileId: 3 }
  ],
  conversations: [],
  messagesByConversation: {}
};

@Injectable({ providedIn: 'root' })
export class ProcessAssistantService {
  private store: AssistantStore;
  private readonly mapGetUrls = [
    '/api/process-assistant/prompt-map',
    '/api/ai-assistant/prompt-map'
  ];
  private readonly mapSaveUrls = [
    '/api/process-assistant/prompt-map/save',
    '/api/process-assistant/prompt-map',
    '/api/ai-assistant/prompt-map/save'
  ];
  private readonly backendResponseUrls = [
    '/api/process-assistant/respond',
    '/api/ai-assistant/respond'
  ];
  private readonly conversationsUrl = '/api/process-assistant/conversations';

  constructor(private http: HttpClient) {
    this.store = this.normalizeStore(DEFAULT_STORE);
  }

  async getPromptMap(): Promise<PromptMapConfig> {
    if (!this.useBackendApi()) {
      const store = this.readStore();
      return { profiles: store.promptProfiles, links: store.promptLinks };
    }

    for (let i = 0; i < this.mapGetUrls.length; i += 1) {
      const url = this.mapGetUrls[i];
      try {
        const response = await firstValueFrom(this.http.get<Partial<PromptMapConfig>>(url));
        const normalized = this.normalizePromptMap(response);
        this.updateStore(store => {
          store.promptProfiles = normalized.profiles;
          store.promptLinks = normalized.links;
        });
        return normalized;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (this.isAuthError(err)) {
          throw error;
        }
        const shouldRetry = this.isNotFoundLike(err) && i < this.mapGetUrls.length - 1;
        if (!shouldRetry) {
          break;
        }
      }
    }
    throw new Error('Process assistant prompt map endpoint is unavailable.');
  }

  async savePromptMap(payload: PromptMapConfig): Promise<PromptMapConfig> {
    const normalized = this.normalizePromptMap(payload);
    if (!this.useBackendApi()) {
      this.updateStore(store => {
        store.promptProfiles = normalized.profiles;
        store.promptLinks = normalized.links;
      });
      return normalized;
    }

    for (let i = 0; i < this.mapSaveUrls.length; i += 1) {
      const url = this.mapSaveUrls[i];
      try {
        const response = await firstValueFrom(this.http.post<Partial<PromptMapConfig>>(url, normalized));
        const saved = this.normalizePromptMap({
          profiles: response?.profiles ?? normalized.profiles,
          links: response?.links ?? normalized.links
        });
        this.updateStore(store => {
          store.promptProfiles = saved.profiles;
          store.promptLinks = saved.links;
        });
        return saved;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (this.isAuthError(err)) {
          throw error;
        }
        const shouldRetry = this.isNotFoundLike(err) && i < this.mapSaveUrls.length - 1;
        if (!shouldRetry) {
          break;
        }
      }
    }
    throw new Error('Process assistant prompt map save endpoint is unavailable.');
  }

  async listPromptProfilesForRole(role: ProcessAssistantRole): Promise<PromptProfile[]> {
    const { profiles, links } = await this.getPromptMap();
    const linkedIds = new Set(
      links
        .filter(link => link.role === role)
        .map(link => link.promptProfileId)
    );
    const linked = profiles
      .filter(profile => profile.active && linkedIds.has(profile.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (linked.length > 0) {
      return linked;
    }
    return profiles.filter(profile => profile.active).sort((a, b) => a.name.localeCompare(b.name));
  }

  async listConversations(userId: number): Promise<AssistantConversation[]> {
    if (this.useBackendApi()) {
      try {
        const response = await firstValueFrom(this.http.get<unknown[]>(this.conversationsUrl));
        const normalized = (Array.isArray(response) ? response : [])
          .map(item => this.normalizeConversation(item))
          .filter((item): item is AssistantConversation => item != null)
          .filter(item => item.userId === userId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        this.updateStore(store => {
          const nextMessages: Record<string, AssistantMessage[]> = {};
          for (const conversation of normalized) {
            nextMessages[conversation.id] = store.messagesByConversation[conversation.id] ?? [];
          }
          store.conversations = normalized;
          store.messagesByConversation = nextMessages;
        });
        return normalized;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (this.isAuthError(err)) throw error;
        throw new Error(this.formatHttpError(err, 'Failed to load conversations.'));
      }
    }

    const store = this.readStore();
    return store.conversations
      .filter(c => c.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createConversation(userId: number, promptProfileId: number | null): Promise<AssistantConversation> {
    if (this.useBackendApi()) {
      try {
        const response = await firstValueFrom(
          this.http.post<unknown>(this.conversationsUrl, {
            title: 'New conversation',
            promptProfileId
          })
        );
        const normalized = this.normalizeConversation(response);
        if (!normalized) {
          throw new Error('Invalid conversation returned by backend.');
        }
        this.updateStore(store => {
          store.conversations = [
            normalized,
            ...store.conversations.filter(c => c.id !== normalized.id)
          ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          store.messagesByConversation[normalized.id] = store.messagesByConversation[normalized.id] ?? [];
        });
        return normalized;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (this.isAuthError(err)) throw error;
        throw new Error(this.formatHttpError(err, 'Failed to create conversation.'));
      }
    }

    const now = new Date().toISOString();
    const conversation: AssistantConversation = {
      id: this.nextId('conv'),
      userId,
      title: 'New conversation',
      promptProfileId,
      createdAt: now,
      updatedAt: now,
      lastMessagePreview: ''
    };

    this.updateStore(store => {
      store.conversations.unshift(conversation);
      store.messagesByConversation[conversation.id] = [];
    });
    return conversation;
  }

  async deleteConversation(userId: number, conversationId: string): Promise<void> {
    if (this.useBackendApi()) {
      const parsedId = this.parseConversationId(conversationId);
      try {
        await firstValueFrom(this.http.delete<void>(`${this.conversationsUrl}/${parsedId}`));
        this.updateStore(store => {
          store.conversations = store.conversations.filter(c => !(c.userId === userId && c.id === conversationId));
          delete store.messagesByConversation[conversationId];
        });
        return;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (this.isAuthError(err)) throw error;
        throw new Error(this.formatHttpError(err, 'Failed to delete conversation.'));
      }
    }

    this.updateStore(store => {
      store.conversations = store.conversations.filter(c => !(c.userId === userId && c.id === conversationId));
      delete store.messagesByConversation[conversationId];
    });
  }

  async setConversationPrompt(
    userId: number,
    conversationId: string,
    promptProfileId: number | null
  ): Promise<void> {
    if (this.useBackendApi()) {
      const parsedId = this.parseConversationId(conversationId);
      try {
        const response = await firstValueFrom(
          this.http.put<unknown>(`${this.conversationsUrl}/${parsedId}/prompt`, { promptProfileId })
        );
        const normalized = this.normalizeConversation(response);
        this.updateStore(store => {
          if (normalized) {
            store.conversations = [
              normalized,
              ...store.conversations.filter(c => c.id !== normalized.id)
            ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          } else {
            const conversation = store.conversations.find(c => c.id === conversationId && c.userId === userId);
            if (conversation) {
              conversation.promptProfileId = promptProfileId;
              conversation.updatedAt = new Date().toISOString();
            }
          }
        });
        return;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (this.isAuthError(err)) throw error;
        throw new Error(this.formatHttpError(err, 'Failed to update prompt profile.'));
      }
    }

    this.updateStore(store => {
      const conversation = store.conversations.find(c => c.id === conversationId && c.userId === userId);
      if (!conversation) return;
      conversation.promptProfileId = promptProfileId;
      conversation.updatedAt = new Date().toISOString();
    });
  }

  async getConversationMessages(userId: number, conversationId: string): Promise<AssistantMessage[]> {
    if (this.useBackendApi()) {
      const parsedId = this.parseConversationId(conversationId);
      try {
        const response = await firstValueFrom(
          this.http.get<unknown[]>(`${this.conversationsUrl}/${parsedId}/messages`)
        );
        const normalizedMessages = (Array.isArray(response) ? response : [])
          .map(item => this.normalizeMessage(item))
          .filter((item): item is AssistantMessage => item != null && item.conversationId === conversationId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        this.updateStore(store => {
          const conversation = store.conversations.find(c => c.id === conversationId && c.userId === userId);
          if (!conversation) return;
          store.messagesByConversation[conversationId] = normalizedMessages;
        });
        return normalizedMessages;
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (this.isAuthError(err)) throw error;
        throw new Error(this.formatHttpError(err, 'Failed to load conversation messages.'));
      }
    }

    const store = this.readStore();
    const conversation = store.conversations.find(c => c.id === conversationId && c.userId === userId);
    if (!conversation) {
      return [];
    }
    const messages = store.messagesByConversation[conversationId] ?? [];
    return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async sendMessage(request: AssistantSendRequest): Promise<AssistantSendResult> {
    if (this.useBackendApi()) {
      const text = (request.text || '').trim();
      if (!text) {
        throw new Error('Message is empty.');
      }
      const parsedId = this.parseConversationId(request.conversationId);
      try {
        const response = await firstValueFrom(
          this.http.post<BackendSendMessageResponse>(
            `${this.conversationsUrl}/${parsedId}/messages`,
            {
              text,
              promptProfileId: request.promptProfileId
            }
          )
        );
        const conversation = this.normalizeConversation(response?.conversation);
        if (!conversation) {
          throw new Error('Invalid conversation response from backend.');
        }
        const normalizedMessages = (Array.isArray(response?.messages) ? response.messages : [])
          .map(item => this.normalizeMessage(item))
          .filter((item): item is AssistantMessage => item != null && item.conversationId === conversation.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        this.updateStore(store => {
          store.conversations = [
            conversation,
            ...store.conversations.filter(c => c.id !== conversation.id)
          ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          store.messagesByConversation[conversation.id] = normalizedMessages;
        });
        return { conversation, messages: normalizedMessages };
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (this.isAuthError(err)) throw error;
        throw new Error(this.formatHttpError(err, 'Assistant request failed.'));
      }
    }

    const text = (request.text || '').trim();
    if (!text) {
      throw new Error('Message is empty.');
    }

    const storeBefore = this.readStore();
    let conversation = storeBefore.conversations.find(c =>
      c.id === request.conversationId && c.userId === request.userId
    );
    if (!conversation) {
      conversation = await this.createConversation(request.userId, request.promptProfileId);
    }

    const now = new Date().toISOString();
    const userMessage: AssistantMessage = {
      id: this.nextId('msg'),
      conversationId: conversation.id,
      role: 'user',
      content: text,
      createdAt: now
    };

    this.updateStore(store => {
      const list = store.messagesByConversation[conversation!.id] ?? [];
      list.push(userMessage);
      store.messagesByConversation[conversation!.id] = list;

      const target = store.conversations.find(c => c.id === conversation!.id && c.userId === request.userId);
      if (target) {
        if (target.title === 'New conversation') {
          target.title = this.titleFromText(text);
        }
        target.promptProfileId = request.promptProfileId ?? target.promptProfileId;
        target.lastMessagePreview = text.slice(0, 160);
        target.updatedAt = now;
      }
    });

    const profile = await this.resolvePromptProfile(request.role, request.promptProfileId);
    const historyForModel = await this.buildModelHistory(request.userId, conversation.id);
    const answer = await this.generateAssistantReply({
      conversationId: conversation.id,
      model: profile?.model || 'gpt-4o-mini',
      temperature: profile?.temperature ?? 0.2,
      maxTokens: profile?.maxTokens ?? 900,
      systemPrompt: profile?.systemPrompt || '',
      history: historyForModel
    });

    const assistantMessage: AssistantMessage = {
      id: this.nextId('msg'),
      conversationId: conversation.id,
      role: 'assistant',
      content: answer,
      createdAt: new Date().toISOString(),
      model: profile?.model || 'gpt-4o-mini'
    };

    this.updateStore(store => {
      const list = store.messagesByConversation[conversation!.id] ?? [];
      list.push(assistantMessage);
      store.messagesByConversation[conversation!.id] = list;

      const target = store.conversations.find(c => c.id === conversation!.id && c.userId === request.userId);
      if (target) {
        target.updatedAt = assistantMessage.createdAt;
        target.lastMessagePreview = answer.slice(0, 160);
      }
    });

    const updatedConversation = this.readStore().conversations.find(c =>
      c.id === conversation.id && c.userId === request.userId
    );
    if (!updatedConversation) {
      throw new Error('Conversation update failed.');
    }

    return {
      conversation: updatedConversation,
      messages: await this.getConversationMessages(request.userId, conversation.id)
    };
  }

  private parseConversationId(conversationId: string): number {
    const value = Number((conversationId || '').toString().trim());
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Invalid conversation ID. Reload conversations and try again.');
    }
    return Math.round(value);
  }

  private async buildModelHistory(userId: number, conversationId: string): Promise<ChatCompletionMessage[]> {
    const messages = await this.getConversationMessages(userId, conversationId);
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map<ChatCompletionMessage>(m => ({
        role: m.role,
        content: m.content
      }));
    return history;
  }

  private async resolvePromptProfile(
    role: ProcessAssistantRole,
    explicitPromptProfileId: number | null
  ): Promise<PromptProfile | null> {
    const map = await this.getPromptMap();
    if (explicitPromptProfileId != null) {
      return map.profiles.find(p => p.id === explicitPromptProfileId) ?? null;
    }
    const roleLink = map.links.find(link => link.role === role);
    if (!roleLink) {
      return map.profiles.find(profile => profile.active) ?? null;
    }
    return map.profiles.find(profile => profile.id === roleLink.promptProfileId) ?? null;
  }

  private async generateAssistantReply(params: {
    conversationId: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    history: ChatCompletionMessage[];
  }): Promise<string> {
    const backendReply = await this.tryBackendAssistantReply(params);
    if (backendReply) {
      return backendReply;
    }
    throw new Error('Assistant backend endpoint is unavailable. Please verify /api/process-assistant/respond.');
  }

  private async tryBackendAssistantReply(params: {
    conversationId: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    history: ChatCompletionMessage[];
  }): Promise<string | null> {
    if (!this.useBackendApi()) {
      return null;
    }

    const payload = {
      conversationId: params.conversationId,
      model: params.model,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      systemPrompt: params.systemPrompt,
      messages: params.history
    };

    for (let i = 0; i < this.backendResponseUrls.length; i += 1) {
      const url = this.backendResponseUrls[i];
      try {
        const response = await firstValueFrom(this.http.post<BackendAssistantResponse>(url, payload));
        const content = this.extractAssistantContent(response);
        if (content) {
          return content;
        }
      } catch (error: unknown) {
        const err = error as HttpErrorResponse;
        if (this.isAuthError(err)) {
          throw error;
        }
        const notFoundLike = this.isNotFoundLike(err);
        const shouldRetry = notFoundLike && i < this.backendResponseUrls.length - 1;
        if (shouldRetry) {
          continue;
        }
        if (notFoundLike) return null;
        throw new Error(this.formatHttpError(err, 'Assistant request failed.'));
      }
    }
    return null;
  }

  private normalizePromptMap(
    raw: Partial<PromptMapConfig> | null | undefined,
    fallback?: PromptMapConfig
  ): PromptMapConfig {
    const baseProfiles = fallback?.profiles ?? DEFAULT_STORE.promptProfiles;
    const baseLinks = fallback?.links ?? DEFAULT_STORE.promptLinks;
    const rawProfiles = Array.isArray(raw?.profiles) ? raw.profiles : baseProfiles;
    const normalizedProfiles = rawProfiles
      .map((profile, index) => this.normalizeProfile(profile, index))
      .filter((profile): profile is PromptProfile => profile != null)
      .sort((a, b) => a.id - b.id);

    const profileIds = new Set(normalizedProfiles.map(p => p.id));
    const rawLinks = Array.isArray(raw?.links) ? raw.links : baseLinks;
    const normalizedLinks: PromptRoleLink[] = [];
    const seen = new Set<string>();
    for (const link of rawLinks) {
      const normalized = this.normalizeLink(link);
      if (!normalized) continue;
      if (!profileIds.has(normalized.promptProfileId)) continue;
      const key = `${normalized.role}:${normalized.promptProfileId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedLinks.push(normalized);
    }

    return {
      profiles: normalizedProfiles,
      links: normalizedLinks
    };
  }

  private normalizeProfile(raw: unknown, index: number): PromptProfile | null {
    const item = raw as Partial<PromptProfile> | null | undefined;
    const id = Number(item?.id);
    if (!Number.isFinite(id) || id <= 0) return null;

    const createdAt = this.validDate(item?.createdAt) ?? new Date().toISOString();
    const updatedAt = this.validDate(item?.updatedAt) ?? createdAt;

    return {
      id,
      name: (item?.name || `Prompt ${index + 1}`).toString().trim() || `Prompt ${index + 1}`,
      systemPrompt: (item?.systemPrompt || '').toString(),
      model: (item?.model || 'gpt-4o-mini').toString().trim() || 'gpt-4o-mini',
      apiKey: (item?.apiKey || '').toString().trim(),
      temperature: this.clampNumber(Number(item?.temperature), 0, 2, 0.2),
      maxTokens: Math.round(this.clampNumber(Number(item?.maxTokens), 128, 4096, 900)),
      active: item?.active !== false,
      xPos: this.clampNumber(Number(item?.xPos), 40, 4200, 560 + index * 40),
      yPos: this.clampNumber(Number(item?.yPos), 20, 4200, 120 + index * 180),
      createdAt,
      updatedAt
    };
  }

  private normalizeLink(raw: unknown): PromptRoleLink | null {
    const item = raw as Partial<PromptRoleLink> | null | undefined;
    const role = this.normalizeRole(item?.role);
    const promptProfileId = Number(item?.promptProfileId);
    if (!role || !Number.isFinite(promptProfileId) || promptProfileId <= 0) {
      return null;
    }
    return { role, promptProfileId };
  }

  private normalizeRole(raw: unknown): ProcessAssistantRole | null {
    const role = String(raw ?? '').trim().toUpperCase().replace('ROLE_', '');
    if (role === 'HEAD_OF_CS') return 'HEAD_CS';
    if ((SUPPORTED_ROLES as string[]).includes(role)) {
      return role as ProcessAssistantRole;
    }
    return null;
  }

  private readStore(): AssistantStore {
    return this.cloneStore(this.store);
  }

  private normalizeStore(raw: Partial<AssistantStore> | null | undefined): AssistantStore {
    const seed = this.cloneStore(DEFAULT_STORE);
    const promptMap = this.normalizePromptMap({
      profiles: Array.isArray(raw?.promptProfiles) ? raw?.promptProfiles : seed.promptProfiles,
      links: Array.isArray(raw?.promptLinks) ? raw?.promptLinks : seed.promptLinks
    }, {
      profiles: seed.promptProfiles,
      links: seed.promptLinks
    });

    const conversations = Array.isArray(raw?.conversations)
      ? raw.conversations
          .map(c => this.normalizeConversation(c))
          .filter((c): c is AssistantConversation => c != null)
      : [];

    const allowedConversationIds = new Set(conversations.map(c => c.id));
    const messagesByConversation: Record<string, AssistantMessage[]> = {};
    const rawMessages = raw?.messagesByConversation ?? {};
    for (const [conversationId, messages] of Object.entries(rawMessages)) {
      if (!allowedConversationIds.has(conversationId)) continue;
      if (!Array.isArray(messages)) continue;
      const normalizedMessages = messages
        .map(m => this.normalizeMessage(m))
        .filter((m): m is AssistantMessage => m != null && m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      messagesByConversation[conversationId] = normalizedMessages;
    }
    for (const conversation of conversations) {
      if (!messagesByConversation[conversation.id]) {
        messagesByConversation[conversation.id] = [];
      }
    }

    return {
      promptProfiles: promptMap.profiles,
      promptLinks: promptMap.links,
      conversations: conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      messagesByConversation
    };
  }

  private normalizeConversation(raw: unknown): AssistantConversation | null {
    const item = raw as Partial<AssistantConversation> | null | undefined;
    const id = (item?.id || '').toString().trim();
    const userId = Number(item?.userId);
    if (!id || !Number.isFinite(userId) || userId <= 0) {
      return null;
    }
    return {
      id,
      userId,
      title: (item?.title || 'New conversation').toString().trim() || 'New conversation',
      promptProfileId: item?.promptProfileId == null ? null : Number(item.promptProfileId),
      createdAt: this.validDate(item?.createdAt) ?? new Date().toISOString(),
      updatedAt: this.validDate(item?.updatedAt) ?? new Date().toISOString(),
      lastMessagePreview: (item?.lastMessagePreview || '').toString()
    };
  }

  private normalizeMessage(raw: unknown): AssistantMessage | null {
    const item = raw as Partial<AssistantMessage> | null | undefined;
    const id = (item?.id || '').toString().trim();
    const conversationId = (item?.conversationId || '').toString().trim();
    const role = (item?.role || '').toString().trim();
    if (!id || !conversationId || !this.isValidMessageRole(role)) {
      return null;
    }
    return {
      id,
      conversationId,
      role: role as AssistantMessageRole,
      content: (item?.content || '').toString(),
      createdAt: this.validDate(item?.createdAt) ?? new Date().toISOString(),
      model: item?.model ? item.model.toString() : undefined
    };
  }

  private updateStore(mutator: (store: AssistantStore) => void): void {
    const store = this.readStore();
    mutator(store);
    this.writeAndReturnNormalizedStore(store);
  }

  private writeAndReturnNormalizedStore(raw: AssistantStore): AssistantStore {
    const normalized = this.normalizeStore(raw);
    this.store = this.cloneStore(normalized);
    return normalized;
  }

  private cloneStore(store: AssistantStore): AssistantStore {
    return JSON.parse(JSON.stringify(store)) as AssistantStore;
  }

  private extractAssistantContent(response: BackendAssistantResponse | null | undefined): string {
    if (!response) return '';
    if (typeof response.content === 'string' && response.content.trim()) {
      return response.content.trim();
    }
    if (typeof response.answer === 'string' && response.answer.trim()) {
      return response.answer.trim();
    }
    if (typeof response.message === 'string' && response.message.trim()) {
      return response.message.trim();
    }
    if (
      typeof response.message === 'object' &&
      response.message != null &&
      typeof response.message.content === 'string' &&
      response.message.content.trim()
    ) {
      return response.message.content.trim();
    }
    return '';
  }

  private isValidMessageRole(raw: string): boolean {
    return raw === 'user' || raw === 'assistant' || raw === 'system';
  }

  private titleFromText(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return 'New conversation';
    return normalized.length > 56 ? `${normalized.slice(0, 56)}...` : normalized;
  }

  private nextId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  private validDate(raw: unknown): string | null {
    const value = (raw || '').toString().trim();
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  private clampNumber(value: number, min: number, max: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  private isAuthError(err: HttpErrorResponse | null | undefined): boolean {
    const status = Number(err?.status || 0);
    return status === 401 || status === 403;
  }

  private isNotFoundLike(err: HttpErrorResponse | null | undefined): boolean {
    const status = Number(err?.status || 0);
    return status === 404 || status === 405 || status === 501;
  }

  private formatHttpError(err: HttpErrorResponse | null | undefined, fallback: string): string {
    if (!err) return fallback;
    const status = Number(err.status || 0);
    const body = err.error as { message?: string; error?: string } | string | null | undefined;
    const apiMessage =
      typeof body === 'string'
        ? body
        : (body?.message || body?.error || err.message || '').toString();

    if (status === 429) {
      return apiMessage || 'OpenAI rate limit/quota reached (429). Check the prompt API key billing/quota.';
    }
    if (apiMessage) return apiMessage;
    return fallback;
  }

  private useBackendApi(): boolean {
    return true;
  }
}

export { SUPPORTED_ROLES };
