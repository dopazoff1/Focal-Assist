import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CrmCase {
  id: number;
  subject: string;
  status: string;
  priority: string;
  queueName: string;
  lastMessageAt: string | null;
  contactName: string;
  contactEmail: string;
  assignedUserId?: number | null;
  assignedTo: string;
  createdBy: string;
  tagNodeIds?: number[];
  tags?: string[];
}

export interface QaEvaluation {
  id: number;
  conversationId: number;
  conversationSubject: string;
  evaluatedUserId: number;
  evaluatedUserName: string;
  evaluatorUserId: number;
  evaluatorUserName: string;
  score: number;
  strengths: string;
  improvements: string;
  comment: string;
  createdAt: string;
}

export interface QaEvaluationCreateRequest {
  conversationId: number;
  evaluatedUserId?: number | null;
  score: number;
  strengths?: string;
  improvements?: string;
  comment?: string;
}

export interface MyPlaylistResponse {
  oldestCase: CrmCase | null;
  cases: CrmCase[];
}

export interface CrmQueueGroup {
  queueName: string;
  tickets: CrmCase[];
}

export interface CrmTicketUpdateRequest {
  status: string;
  reply: string;
  tagNodeIds?: number[];
}

export interface GmailSyncResponse {
  synced: boolean;
  created: number;
  updated: number;
  gmailAddress: string;
}

export interface GmailThreadMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  internalNote?: boolean;
  attachments?: GmailThreadAttachment[];
}

export interface GmailThreadAttachment {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  inline: boolean;
  contentId: string;
  downloadUrl: string;
}

export interface GmailThreadResponse {
  conversationId: number;
  threadId: string;
  subject: string;
  messages: GmailThreadMessage[];
}

export interface InternalNoteSaveResponse {
  saved: boolean;
  message: GmailThreadMessage;
}

export interface ChatChannel {
  type: 'whatsapp' | 'instagram';
  label: string;
  handle: string;
  connected: boolean;
  lastSyncAt: string | null;
}

export interface ChatConversation {
  id: number;
  channel: 'whatsapp' | 'instagram' | 'webchat';
  customerName: string;
  customerHandle: string;
  status: 'open' | 'pending' | 'resolved';
  unread: number;
  lastMessageAt: string | null;
  assignedUserId: number | null;
  assignedTo: string;
}

export interface ChatMessage {
  id: number;
  sender: 'agent' | 'customer';
  senderName: string;
  text: string;
  at: string;
}

export interface ChatInboundRequest {
  channel: 'whatsapp' | 'instagram' | 'webchat';
  externalThreadId?: string | null;
  customerName: string;
  customerHandle: string;
  text: string;
}

export interface ChatOauthStart {
  authUrl: string;
  state: string;
}

export interface ChatWidgetConfig {
  websiteName: string;
  enabled: boolean;
  widgetToken: string;
  inboundUrl: string;
  scriptSnippet: string;
}

export interface ChatWidgetConfigRequest {
  websiteName: string;
  enabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CrmService {
  private readonly API_URL = '/api/crm';
  private readonly GMAIL_API_URL = '/api/gmail';

  constructor(private http: HttpClient) {}

  getMyPlaylist(userId: number): Observable<MyPlaylistResponse> {
    return this.http.get<MyPlaylistResponse>(`${this.API_URL}/my-playlist/${userId}`);
  }

  getOpenCases(userId: number): Observable<CrmQueueGroup[]> {
    return this.http.get<CrmQueueGroup[]>(`${this.API_URL}/open-cases/${userId}`);
  }

  getAllCases(): Observable<CrmCase[]> {
    return this.http.get<CrmCase[]>(`${this.API_URL}/all-cases`);
  }

  submitMyPlaylistAndNext(userId: number, conversationId: number, payload: CrmTicketUpdateRequest): Observable<MyPlaylistResponse> {
    return this.http.post<MyPlaylistResponse>(`${this.API_URL}/my-playlist/${userId}/submit-next/${conversationId}`, payload);
  }

  updateAssignedCase(userId: number, conversationId: number, payload: CrmTicketUpdateRequest): Observable<CrmCase> {
    return this.http.put<CrmCase>(`${this.API_URL}/cases/${userId}/${conversationId}`, payload);
  }

  syncInbox(userId: number): Observable<GmailSyncResponse> {
    return this.http.post<GmailSyncResponse>(`${this.GMAIL_API_URL}/sync/${userId}`, {});
  }

  getThread(userId: number, conversationId: number): Observable<GmailThreadResponse> {
    return this.http.get<GmailThreadResponse>(`${this.GMAIL_API_URL}/thread/${userId}/${conversationId}`);
  }

  sendReply(userId: number, conversationId: number, reply: string): Observable<{ sent: boolean }> {
    return this.http.post<{ sent: boolean }>(`${this.GMAIL_API_URL}/reply/${userId}/${conversationId}`, { reply });
  }

  addInternalNote(userId: number, conversationId: number, note: string): Observable<InternalNoteSaveResponse> {
    return this.http.post<InternalNoteSaveResponse>(`${this.API_URL}/cases/${userId}/${conversationId}/internal-note`, { note });
  }

  getGmailOAuthUrl(userId: number): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.GMAIL_API_URL}/oauth/url/${userId}`);
  }

  getEvaluations(): Observable<QaEvaluation[]> {
    return this.http.get<QaEvaluation[]>(`${this.API_URL}/evaluations`);
  }

  getEvaluationsByCase(conversationId: number): Observable<QaEvaluation[]> {
    return this.http.get<QaEvaluation[]>(`${this.API_URL}/evaluations/case/${conversationId}`);
  }

  createEvaluation(payload: QaEvaluationCreateRequest): Observable<QaEvaluation> {
    return this.http.post<QaEvaluation>(`${this.API_URL}/evaluations`, payload);
  }

  getChatChannels(userId: number): Observable<ChatChannel[]> {
    return this.http.get<ChatChannel[]>(`${this.API_URL}/chats/channels/${userId}`);
  }

  startChatOauth(userId: number, channelType: 'whatsapp' | 'instagram'): Observable<ChatOauthStart> {
    return this.http.get<ChatOauthStart>(`${this.API_URL}/chats/oauth/${userId}/${channelType}/start`);
  }

  linkChatChannel(userId: number, channelType: 'whatsapp' | 'instagram', handle: string): Observable<ChatChannel> {
    return this.http.put<ChatChannel>(`${this.API_URL}/chats/channels/${userId}/${channelType}/link`, { handle });
  }

  unlinkChatChannel(userId: number, channelType: 'whatsapp' | 'instagram'): Observable<ChatChannel> {
    return this.http.delete<ChatChannel>(`${this.API_URL}/chats/channels/${userId}/${channelType}/link`);
  }

  getChatWidgetConfig(userId: number): Observable<ChatWidgetConfig> {
    return this.http.get<ChatWidgetConfig>(`${this.API_URL}/chats/widget/${userId}`);
  }

  updateChatWidgetConfig(userId: number, payload: ChatWidgetConfigRequest): Observable<ChatWidgetConfig> {
    return this.http.put<ChatWidgetConfig>(`${this.API_URL}/chats/widget/${userId}`, payload);
  }

  getMyChats(userId: number): Observable<ChatConversation[]> {
    return this.http.get<ChatConversation[]>(`${this.API_URL}/chats/${userId}`);
  }

  getChatMessages(userId: number, conversationId: number): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.API_URL}/chats/${userId}/${conversationId}/messages`);
  }

  replyChat(userId: number, conversationId: number, text: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.API_URL}/chats/${userId}/${conversationId}/reply`, { text });
  }

  ingestInboundChat(payload: ChatInboundRequest): Observable<ChatConversation> {
    return this.http.post<ChatConversation>(`${this.API_URL}/chats/inbound`, payload);
  }
}

