import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, firstValueFrom, interval, map, merge } from 'rxjs';

export type CollaborationRoomKind = 'CHANNEL' | 'DIRECT';
export type CollaborationMessageKind = 'USER' | 'SYSTEM';
export type CollaborationDeliveryState = 'SENT' | 'SEEN';

export interface CollaborationUser {
  id: number;
  name: string;
  handle: string;
  email: string;
  role: string;
  status: string;
  active: boolean;
}

export interface CollaborationChannel {
  id: string;
  kind: 'CHANNEL';
  name: string;
  description: string;
  topic: string;
  isPrivate: boolean;
  memberIds: number[];
  ownerId: number;
  createdAt: string;
  linkedArticleIds: number[];
  archived: boolean;
}

export interface CollaborationDirectRoom {
  id: string;
  kind: 'DIRECT';
  memberIds: number[];
  createdAt: string;
  linkedArticleIds: number[];
  archived: boolean;
}

export type CollaborationRoom = CollaborationChannel | CollaborationDirectRoom;

export interface CollaborationMessage {
  id: string;
  roomId: string;
  senderId: number;
  kind: CollaborationMessageKind;
  content: string;
  createdAt: string;
  editedAt?: string;
  parentId?: string | null;
  mentionUserIds: number[];
  linkedArticleIds: number[];
  reactions: Record<string, number[]>;
  pinned: boolean;
  deliveryState?: CollaborationDeliveryState;
}

export interface CollaborationTypingState {
  typingUserIds: number[];
}

export interface CollaborationPreferences {
  starredRoomIds: string[];
  mutedRoomIds: string[];
  savedMessageIds: string[];
  lastReadAtByRoom: Record<string, string>;
}

export interface CollaborationWorkspaceView {
  users: CollaborationUser[];
  channels: CollaborationChannel[];
  directs: CollaborationDirectRoom[];
  rooms: CollaborationRoom[];
  preferences: CollaborationPreferences;
  unreadByRoom: Record<string, number>;
  mentionInbox: CollaborationMessage[];
  savedMessages: CollaborationMessage[];
}

export interface CollaborationCurrentUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

export interface CollaborationChannelAccessMap {
  users: CollaborationUser[];
  channels: CollaborationChannel[];
  channelIdsByUserId: Record<string, number[]>;
}

@Injectable({ providedIn: 'root' })
export class CollaborationService {
  private readonly apiUrl = '/api/collaboration';
  private readonly updateTicks = new Subject<number>();
  private readonly pollMs = 3000;

  constructor(private http: HttpClient) {}

  watchStoreUpdates(): Observable<number> {
    return merge(
      this.updateTicks.asObservable(),
      interval(this.pollMs).pipe(map(() => Date.now()))
    );
  }

  async getChannelAccessMap(_currentUser: CollaborationCurrentUser): Promise<CollaborationChannelAccessMap> {
    const response = await this.runRequest('Failed to load channel access map.', () =>
      firstValueFrom(this.http.get<unknown>(`${this.apiUrl}/channel-access/map`))
    );
    return this.normalizeChannelAccessMap(response);
  }

  async replaceUserChannelAccess(
    _currentUser: CollaborationCurrentUser,
    userId: number,
    channelIds: number[]
  ): Promise<CollaborationChannelAccessMap> {
    const targetUserId = Number(userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      throw new Error('Invalid user id.');
    }

    const response = await this.runRequest('Failed to save channel access.', () =>
      firstValueFrom(this.http.put<unknown>(`${this.apiUrl}/channel-access/users/${targetUserId}/replace`, {
        channelIds: this.uniqueNumbers(channelIds || [])
      }))
    );
    this.emitUpdate();
    return this.normalizeChannelAccessMap(response);
  }

  async getWorkspace(_currentUser: CollaborationCurrentUser): Promise<CollaborationWorkspaceView> {
    const response = await this.runRequest('Failed to load collaboration workspace.', () =>
      firstValueFrom(this.http.get<Partial<CollaborationWorkspaceView>>(`${this.apiUrl}/workspace`))
    );
    return this.normalizeWorkspace(response);
  }

  async createChannel(
    _currentUser: CollaborationCurrentUser,
    payload: {
      name: string;
      description: string;
      topic: string;
      isPrivate: boolean;
      memberIds: number[];
    }
  ): Promise<CollaborationChannel> {
    const room = await this.runRequest('Failed to create channel.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/channels`, {
        name: payload.name,
        description: payload.description,
        topic: payload.topic,
        isPrivate: !!payload.isPrivate,
        memberIds: this.uniqueNumbers(payload.memberIds)
      }))
    );
    this.emitUpdate();
    return this.normalizeRoom(room) as CollaborationChannel;
  }

  async inviteChannelMembers(
    currentUser: CollaborationCurrentUser,
    channelId: string,
    memberIds: number[]
  ): Promise<number[]> {
    const roomId = this.parsePositiveId(channelId);
    if (!roomId) {
      throw new Error('Invalid channel id.');
    }

    const requested = this.uniqueNumbers(memberIds);
    if (!requested.length) {
      return [];
    }

    let existingMembers = new Set<number>();
    try {
      const workspace = await this.getWorkspace(currentUser);
      const currentRoom = workspace.rooms.find(room => room.id === String(roomId));
      existingMembers = new Set(currentRoom?.memberIds || []);
    } catch {
      existingMembers = new Set<number>();
    }

    const updatedRoom = await this.runRequest('Failed to invite members.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/rooms/${roomId}/invite`, {
        memberIds: requested
      }))
    );

    this.emitUpdate();

    const normalizedRoom = this.normalizeRoom(updatedRoom);
    const requestedSet = new Set(requested);
    return normalizedRoom.memberIds.filter(id => requestedSet.has(id) && !existingMembers.has(id));
  }

  async createDirectRoom(
    _currentUser: CollaborationCurrentUser,
    targetUserId: number
  ): Promise<CollaborationDirectRoom> {
    const targetId = Number(targetUserId);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      throw new Error('Invalid user for direct message.');
    }

    const room = await this.runRequest('Failed to create direct room.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/directs`, { targetUserId: targetId }))
    );
    this.emitUpdate();
    return this.normalizeRoom(room) as CollaborationDirectRoom;
  }

  async setRoomTopic(
    _currentUser: CollaborationCurrentUser,
    roomId: string,
    topic: string
  ): Promise<void> {
    const id = this.parsePositiveId(roomId);
    if (!id) throw new Error('Invalid room id.');

    await this.runRequest('Failed to update topic.', () =>
      firstValueFrom(this.http.put<unknown>(`${this.apiUrl}/rooms/${id}/topic`, { topic: topic || '' }))
    );
    this.emitUpdate();
  }

  async setRoomLinkedArticles(
    _currentUser: CollaborationCurrentUser,
    roomId: string,
    articleIds: number[]
  ): Promise<void> {
    const id = this.parsePositiveId(roomId);
    if (!id) throw new Error('Invalid room id.');

    await this.runRequest('Failed to link articles to room.', () =>
      firstValueFrom(this.http.put<unknown>(`${this.apiUrl}/rooms/${id}/articles`, {
        articleIds: this.uniqueNumbers(articleIds)
      }))
    );
    this.emitUpdate();
  }

  async getRoomMessages(
    _currentUser: CollaborationCurrentUser,
    roomId: string
  ): Promise<CollaborationMessage[]> {
    const id = this.parsePositiveId(roomId);
    if (!id) return [];

    const messages = await this.runRequest('Failed to load room messages.', () =>
      firstValueFrom(this.http.get<unknown[]>(`${this.apiUrl}/rooms/${id}/messages`))
    );
    return (Array.isArray(messages) ? messages : [])
      .map(message => this.normalizeMessage(message))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async sendMessage(
    _currentUser: CollaborationCurrentUser,
    roomId: string,
    content: string,
    options?: { parentId?: string | null; linkedArticleIds?: number[] }
  ): Promise<CollaborationMessage> {
    const id = this.parsePositiveId(roomId);
    if (!id) throw new Error('Invalid room id.');

    const payload = {
      content,
      parentId: options?.parentId || null,
      linkedArticleIds: this.uniqueNumbers(options?.linkedArticleIds || [])
    };

    const message = await this.runRequest('Failed to send message.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/rooms/${id}/messages`, payload))
    );
    this.emitUpdate();
    return this.normalizeMessage(message);
  }

  async editMessage(
    _currentUser: CollaborationCurrentUser,
    roomId: string,
    messageId: string,
    content: string
  ): Promise<void> {
    const rid = this.parsePositiveId(roomId);
    const mid = this.parsePositiveId(messageId);
    if (!rid || !mid) throw new Error('Invalid message id.');

    await this.runRequest('Failed to edit message.', () =>
      firstValueFrom(this.http.put<unknown>(`${this.apiUrl}/rooms/${rid}/messages/${mid}`, { content }))
    );
    this.emitUpdate();
  }

  async deleteMessage(
    _currentUser: CollaborationCurrentUser,
    roomId: string,
    messageId: string
  ): Promise<void> {
    const rid = this.parsePositiveId(roomId);
    const mid = this.parsePositiveId(messageId);
    if (!rid || !mid) throw new Error('Invalid message id.');

    await this.runRequest('Failed to delete message.', () =>
      firstValueFrom(this.http.delete<void>(`${this.apiUrl}/rooms/${rid}/messages/${mid}`))
    );
    this.emitUpdate();
  }

  async toggleReaction(
    _currentUser: CollaborationCurrentUser,
    roomId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    const rid = this.parsePositiveId(roomId);
    const mid = this.parsePositiveId(messageId);
    if (!rid || !mid) throw new Error('Invalid message id.');

    await this.runRequest('Failed to update reaction.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/rooms/${rid}/messages/${mid}/reaction`, { emoji }))
    );
    this.emitUpdate();
  }

  async togglePinMessage(
    _currentUser: CollaborationCurrentUser,
    roomId: string,
    messageId: string
  ): Promise<void> {
    const rid = this.parsePositiveId(roomId);
    const mid = this.parsePositiveId(messageId);
    if (!rid || !mid) throw new Error('Invalid message id.');

    await this.runRequest('Failed to toggle pin.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/rooms/${rid}/messages/${mid}/pin`, {}))
    );
    this.emitUpdate();
  }

  async toggleSaveMessage(
    _currentUser: CollaborationCurrentUser,
    roomId: string,
    messageId: string
  ): Promise<void> {
    const rid = this.parsePositiveId(roomId);
    const mid = this.parsePositiveId(messageId);
    if (!rid || !mid) throw new Error('Invalid message id.');

    await this.runRequest('Failed to save message.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/rooms/${rid}/messages/${mid}/save`, {}))
    );
    this.emitUpdate();
  }

  async toggleRoomStar(
    _currentUser: CollaborationCurrentUser,
    roomId: string
  ): Promise<void> {
    const rid = this.parsePositiveId(roomId);
    if (!rid) throw new Error('Invalid room id.');

    await this.runRequest('Failed to toggle room star.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/rooms/${rid}/star`, {}))
    );
    this.emitUpdate();
  }

  async toggleRoomMute(
    _currentUser: CollaborationCurrentUser,
    roomId: string
  ): Promise<void> {
    const rid = this.parsePositiveId(roomId);
    if (!rid) throw new Error('Invalid room id.');

    await this.runRequest('Failed to toggle room mute.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/rooms/${rid}/mute`, {}))
    );
    this.emitUpdate();
  }

  async markRoomRead(
    _currentUser: CollaborationCurrentUser,
    roomId: string
  ): Promise<void> {
    const rid = this.parsePositiveId(roomId);
    if (!rid) return;

    await this.runRequest('Failed to mark room as read.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/rooms/${rid}/read`, {}))
    );
    this.emitUpdate();
  }

  async setTyping(
    _currentUser: CollaborationCurrentUser,
    roomId: string,
    typing: boolean
  ): Promise<CollaborationTypingState> {
    const rid = this.parsePositiveId(roomId);
    if (!rid) return { typingUserIds: [] };

    const response = await this.runRequest('Failed to update typing state.', () =>
      firstValueFrom(this.http.post<unknown>(`${this.apiUrl}/rooms/${rid}/typing`, { typing: !!typing }))
    );
    return this.normalizeTypingState(response);
  }

  async getTyping(
    _currentUser: CollaborationCurrentUser,
    roomId: string
  ): Promise<CollaborationTypingState> {
    const rid = this.parsePositiveId(roomId);
    if (!rid) return { typingUserIds: [] };

    const response = await this.runRequest('Failed to load typing state.', () =>
      firstValueFrom(this.http.get<unknown>(`${this.apiUrl}/rooms/${rid}/typing`))
    );
    return this.normalizeTypingState(response);
  }

  async searchMessages(
    _currentUser: CollaborationCurrentUser,
    query: string,
    roomId?: string
  ): Promise<CollaborationMessage[]> {
    const q = (query || '').trim();
    if (!q) return [];

    let params = new HttpParams().set('query', q);
    const rid = this.parsePositiveId(roomId || '');
    if (rid) {
      params = params.set('roomId', String(rid));
    }

    const messages = await this.runRequest('Failed to search messages.', () =>
      firstValueFrom(this.http.get<unknown[]>(`${this.apiUrl}/messages/search`, { params }))
    );

    return (Array.isArray(messages) ? messages : [])
      .map(message => this.normalizeMessage(message));
  }

  private emitUpdate(): void {
    this.updateTicks.next(Date.now());
  }

  private parsePositiveId(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private normalizeWorkspace(raw: Partial<CollaborationWorkspaceView> | null | undefined): CollaborationWorkspaceView {
    const users = Array.isArray(raw?.users) ? raw.users.map(user => this.normalizeUser(user)) : [];
    const roomList = Array.isArray(raw?.rooms)
      ? raw.rooms.map(room => this.normalizeRoom(room))
      : [];

    const channels = roomList.filter((room): room is CollaborationChannel => room.kind === 'CHANNEL');
    const directs = roomList.filter((room): room is CollaborationDirectRoom => room.kind === 'DIRECT');

    const preferences = this.normalizePreferences(raw?.preferences || null);
    const unreadByRoom = this.normalizeUnread(raw?.unreadByRoom || null);

    const mentionInbox = Array.isArray(raw?.mentionInbox)
      ? raw.mentionInbox.map(message => this.normalizeMessage(message))
      : [];

    const savedMessages = Array.isArray(raw?.savedMessages)
      ? raw.savedMessages.map(message => this.normalizeMessage(message))
      : [];

    return {
      users,
      channels,
      directs,
      rooms: roomList,
      preferences,
      unreadByRoom,
      mentionInbox,
      savedMessages
    };
  }

  private normalizeChannelAccessMap(raw: any): CollaborationChannelAccessMap {
    const users = Array.isArray(raw?.users)
      ? raw.users.map((user: any) => this.normalizeUser(user)).filter((user: CollaborationUser) => user.id > 0)
      : [];

    const channels = (Array.isArray(raw?.channels) ? raw.channels : [])
      .map((room: any) => this.normalizeRoom(room))
      .filter((room: CollaborationRoom): room is CollaborationChannel => room.kind === 'CHANNEL');

    const knownChannelIds = new Set<number>(channels
      .map((channel: CollaborationChannel) => Number(channel.id))
      .filter((id: number) => Number.isFinite(id) && id > 0));

    const channelIdsByUserId: Record<string, number[]> = {};
    const source = raw?.channelIdsByUserId && typeof raw.channelIdsByUserId === 'object'
      ? raw.channelIdsByUserId
      : {};

    for (const [userId, channelIds] of Object.entries(source)) {
      const key = String(userId || '').trim();
      if (!key) continue;
      const normalizedIds = this.uniqueNumbers(Array.isArray(channelIds) ? channelIds : [])
        .filter(channelId => knownChannelIds.has(channelId));
      channelIdsByUserId[key] = normalizedIds;
    }

    for (const user of users) {
      const key = String(user.id);
      if (!Array.isArray(channelIdsByUserId[key])) {
        channelIdsByUserId[key] = [];
      }
    }

    return {
      users,
      channels,
      channelIdsByUserId
    };
  }

  private normalizeUser(raw: any): CollaborationUser {
    const id = Number(raw?.id || 0);
    return {
      id: Number.isFinite(id) && id > 0 ? id : 0,
      name: (raw?.name || '').toString(),
      handle: (raw?.handle || '').toString(),
      email: (raw?.email || '').toString(),
      role: (raw?.role || 'AGENT').toString().toUpperCase(),
      status: (raw?.status || 'OFFLINE').toString().toUpperCase(),
      active: raw?.active !== false
    };
  }

  private normalizeRoom(raw: any): CollaborationRoom {
    const kind = this.normalizeRoomKind(raw?.kind);
    const common = {
      id: String(raw?.id || ''),
      memberIds: this.uniqueNumbers(raw?.memberIds || []),
      createdAt: (raw?.createdAt || new Date().toISOString()).toString(),
      linkedArticleIds: this.uniqueNumbers(raw?.linkedArticleIds || []),
      archived: raw?.archived === true
    };

    if (kind === 'DIRECT') {
      return {
        id: common.id,
        kind: 'DIRECT',
        memberIds: common.memberIds,
        createdAt: common.createdAt,
        linkedArticleIds: common.linkedArticleIds,
        archived: common.archived
      };
    }

    return {
      id: common.id,
      kind: 'CHANNEL',
      name: (raw?.name || '').toString(),
      description: (raw?.description || '').toString(),
      topic: (raw?.topic || '').toString(),
      isPrivate: raw?.isPrivate === true,
      memberIds: common.memberIds,
      ownerId: Number(raw?.ownerId || 0),
      createdAt: common.createdAt,
      linkedArticleIds: common.linkedArticleIds,
      archived: common.archived
    };
  }

  private normalizeMessage(raw: any): CollaborationMessage {
    const reactions: Record<string, number[]> = {};
    const source = raw?.reactions && typeof raw.reactions === 'object' ? raw.reactions : {};

    for (const [emoji, users] of Object.entries(source)) {
      reactions[String(emoji)] = this.uniqueNumbers(Array.isArray(users) ? users : []);
    }

    return {
      id: String(raw?.id || ''),
      roomId: String(raw?.roomId || ''),
      senderId: Number(raw?.senderId || 0),
      kind: this.normalizeMessageKind(raw?.kind),
      content: (raw?.content || '').toString(),
      createdAt: (raw?.createdAt || new Date().toISOString()).toString(),
      editedAt: raw?.editedAt ? String(raw.editedAt) : undefined,
      parentId: raw?.parentId == null || raw?.parentId === '' ? null : String(raw.parentId),
      mentionUserIds: this.uniqueNumbers(raw?.mentionUserIds || []),
      linkedArticleIds: this.uniqueNumbers(raw?.linkedArticleIds || []),
      reactions,
      pinned: raw?.pinned === true,
      deliveryState: this.normalizeDeliveryState(raw?.deliveryState)
    };
  }

  private normalizeTypingState(raw: any): CollaborationTypingState {
    return {
      typingUserIds: this.uniqueNumbers(raw?.typingUserIds || [])
    };
  }

  private normalizePreferences(raw: any): CollaborationPreferences {
    const lastReadAtByRoom: Record<string, string> = {};
    if (raw?.lastReadAtByRoom && typeof raw.lastReadAtByRoom === 'object') {
      for (const [key, value] of Object.entries(raw.lastReadAtByRoom)) {
        const roomId = String(key || '').trim();
        const ts = String(value || '').trim();
        if (roomId && ts) {
          lastReadAtByRoom[roomId] = ts;
        }
      }
    }

    return {
      starredRoomIds: this.normalizeStringList(raw?.starredRoomIds),
      mutedRoomIds: this.normalizeStringList(raw?.mutedRoomIds),
      savedMessageIds: this.normalizeStringList(raw?.savedMessageIds),
      lastReadAtByRoom
    };
  }

  private normalizeUnread(raw: any): Record<string, number> {
    const out: Record<string, number> = {};
    if (!raw || typeof raw !== 'object') {
      return out;
    }
    for (const [roomId, value] of Object.entries(raw)) {
      const key = String(roomId || '').trim();
      const count = Number(value || 0);
      if (key) {
        out[key] = Number.isFinite(count) ? count : 0;
      }
    }
    return out;
  }

  private normalizeStringList(values: any): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    const set = new Set<string>();
    for (const item of values) {
      const val = String(item || '').trim();
      if (val) set.add(val);
    }
    return [...set];
  }

  private normalizeRoomKind(value: any): CollaborationRoomKind {
    return String(value || '').toUpperCase() === 'DIRECT' ? 'DIRECT' : 'CHANNEL';
  }

  private normalizeMessageKind(value: any): CollaborationMessageKind {
    return String(value || '').toUpperCase() === 'SYSTEM' ? 'SYSTEM' : 'USER';
  }

  private normalizeDeliveryState(value: any): CollaborationDeliveryState | undefined {
    const normalized = String(value || '').toUpperCase();
    if (normalized === 'SEEN') return 'SEEN';
    if (normalized === 'SENT') return 'SENT';
    return undefined;
  }

  private uniqueNumbers(values: any[]): number[] {
    const unique = new Set<number>();
    for (const value of Array.isArray(values) ? values : []) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        unique.add(parsed);
      }
    }
    return [...unique];
  }

  private async runRequest<T>(fallbackMessage: string, executor: () => Promise<T>): Promise<T> {
    try {
      return await executor();
    } catch (error: unknown) {
      throw new Error(this.formatError(error, fallbackMessage));
    }
  }

  private formatError(error: unknown, fallbackMessage: string): string {
    const httpError = error as HttpErrorResponse;
    const apiMessage = this.extractApiMessage(httpError);
    if (apiMessage) {
      return apiMessage;
    }
    if (Number(httpError?.status || 0) > 0) {
      return `${fallbackMessage} (${httpError.status})`;
    }
    return fallbackMessage;
  }

  private extractApiMessage(error: HttpErrorResponse): string {
    const body = error?.error;
    if (!body) return '';
    if (typeof body === 'string') {
      return body.trim();
    }
    if (typeof body === 'object') {
      const message = (body as any).message || (body as any).error || (body as any).apiMessage;
      return String(message || '').trim();
    }
    return '';
  }
}
