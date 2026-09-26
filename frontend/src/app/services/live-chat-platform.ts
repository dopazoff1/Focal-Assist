import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface ChatProject {
  id: number;
  name: string;
  slug: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  brandColor?: string;
  welcomeMessage?: string;
  publicEnabled?: boolean;
  publicUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatQueue {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  color?: string;
  priority?: number;
  archived?: boolean;
  agents?: ChatUser[];
  agentIds?: number[];
}

export interface ChatUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status?: string;
  active?: boolean;
}

export interface WorkflowNode {
  id?: number;
  clientNodeId: string;
  type: string;
  title: string;
  x: number;
  y: number;
  properties?: Record<string, any>;
}

export interface WorkflowConnection {
  id?: number;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface ChatWorkflow {
  id?: number;
  projectId?: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  version: number;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

export interface LiveChatSession {
  id: number;
  projectId: number;
  projectName: string;
  projectSlug: string;
  queueId?: number;
  queueName?: string;
  assignedAgentId?: number;
  assignedAgentName?: string;
  publicToken: string;
  customerName?: string;
  customerEmail?: string;
  status: string;
  currentNodeId?: string;
  lastMessagePreview?: string;
  unreadForAgent?: number;
  unreadForCustomer?: number;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
}

export interface LiveChatMessage {
  id: number;
  sessionId: number;
  senderType: 'BOT' | 'CUSTOMER' | 'AGENT' | 'SYSTEM';
  senderUserId?: number;
  senderName?: string;
  body: string;
  metadataJson?: string;
  createdAt?: string;
}

export interface LiveChatBundle {
  session: LiveChatSession;
  messages: LiveChatMessage[];
}

export interface LiveChatEvent {
  type: string;
  sessionId?: number;
  payload?: any;
}

@Injectable({ providedIn: 'root' })
export class LiveChatPlatformService {
  private readonly chatEvents = new Subject<LiveChatEvent>();
  private socket?: WebSocket;

  constructor(private http: HttpClient, private zone: NgZone) {}

  watchEvents(): Observable<LiveChatEvent> {
    return this.chatEvents.asObservable();
  }

  connectSocket(sessionId?: number): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    this.socket = new WebSocket(`${proto}://${window.location.host}/ws/live-chat${query}`);
    this.socket.onmessage = event => {
      this.zone.run(() => {
        try {
          this.chatEvents.next(JSON.parse(event.data));
        } catch {
          this.chatEvents.next({ type: 'raw', payload: event.data });
        }
      });
    };
    this.socket.onclose = () => {
      this.socket = undefined;
      window.setTimeout(() => this.connectSocket(sessionId), 2500);
    };
  }

  listProjects(q = ''): Observable<ChatProject[]> {
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.http.get<ChatProject[]>('/api/chat-projects', { params });
  }

  getProject(id: number): Observable<any> {
    return this.http.get<any>(`/api/chat-projects/${id}`);
  }

  listAssignableUsers(): Observable<ChatUser[]> {
    return this.http.get<ChatUser[]>('/api/chat-projects/agents');
  }

  createProject(payload: Partial<ChatProject>): Observable<any> {
    return this.http.post<any>('/api/chat-projects', payload);
  }

  updateProject(id: number, payload: Partial<ChatProject>): Observable<any> {
    return this.http.put<any>(`/api/chat-projects/${id}`, payload);
  }

  duplicateProject(id: number): Observable<any> {
    return this.http.post<any>(`/api/chat-projects/${id}/duplicate`, {});
  }

  archiveProject(id: number): Observable<any> {
    return this.http.post<any>(`/api/chat-projects/${id}/archive`, {});
  }

  activateProject(id: number): Observable<any> {
    return this.http.post<any>(`/api/chat-projects/${id}/activate`, {});
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`/api/chat-projects/${id}`);
  }

  rotateApiKey(projectId: number): Observable<any> {
    return this.http.post<any>(`/api/chat-projects/${projectId}/api-keys/rotate`, {});
  }

  saveWorkflow(projectId: number, workflow: Pick<ChatWorkflow, 'nodes' | 'connections'>): Observable<ChatWorkflow> {
    return this.http.put<ChatWorkflow>(`/api/chat-projects/${projectId}/workflow`, workflow);
  }

  publishWorkflow(projectId: number): Observable<ChatWorkflow> {
    return this.http.post<ChatWorkflow>(`/api/chat-projects/${projectId}/workflow/publish`, {});
  }

  listQueues(projectId: number): Observable<ChatQueue[]> {
    return this.http.get<ChatQueue[]>(`/api/chat-projects/${projectId}/queues`);
  }

  createQueue(projectId: number, payload: Partial<ChatQueue>): Observable<ChatQueue> {
    return this.http.post<ChatQueue>(`/api/chat-projects/${projectId}/queues`, payload);
  }

  updateQueue(projectId: number, queueId: number, payload: Partial<ChatQueue>): Observable<ChatQueue> {
    return this.http.put<ChatQueue>(`/api/chat-projects/${projectId}/queues/${queueId}`, payload);
  }

  replaceQueueAgents(projectId: number, queueId: number, agentIds: number[]): Observable<ChatQueue> {
    return this.http.put<ChatQueue>(`/api/chat-projects/${projectId}/queues/${queueId}/agents`, { agentIds });
  }

  listSessions(filters: { projectId?: number; queueId?: number; status?: string; agentId?: number } = {}): Observable<LiveChatSession[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<LiveChatSession[]>('/api/live-chat/sessions', { params });
  }

  claimNext(projectId?: number): Observable<LiveChatBundle> {
    return this.http.post<LiveChatBundle>('/api/live-chat/claim-next', { projectId });
  }

  getMessages(sessionId: number): Observable<LiveChatMessage[]> {
    return this.http.get<LiveChatMessage[]>(`/api/live-chat/sessions/${sessionId}/messages`);
  }

  sendAgentMessage(sessionId: number, body: string): Observable<LiveChatBundle> {
    return this.http.post<LiveChatBundle>(`/api/live-chat/sessions/${sessionId}/messages`, { body });
  }

  closeSession(sessionId: number): Observable<LiveChatBundle> {
    return this.http.post<LiveChatBundle>(`/api/live-chat/sessions/${sessionId}/close`, {});
  }

  getPublicProject(slug: string): Observable<any> {
    return this.http.get<any>(`/api/public/chat/${encodeURIComponent(slug)}`);
  }

  startPublicSession(slug: string, payload: any): Observable<LiveChatBundle> {
    return this.http.post<LiveChatBundle>(`/api/public/chat/${encodeURIComponent(slug)}/sessions`, payload);
  }

  getPublicMessages(token: string): Observable<LiveChatMessage[]> {
    return this.http.get<LiveChatMessage[]>(`/api/public/chat/sessions/${encodeURIComponent(token)}/messages`);
  }

  getPublicSession(token: string): Observable<LiveChatBundle> {
    return this.http.get<LiveChatBundle>(`/api/public/chat/sessions/${encodeURIComponent(token)}`);
  }

  sendPublicMessage(token: string, body: string): Observable<LiveChatBundle> {
    return this.http.post<LiveChatBundle>(`/api/public/chat/sessions/${encodeURIComponent(token)}/messages`, { body });
  }

  submitPublicCsat(token: string, rating: number, comment = ''): Observable<LiveChatBundle> {
    return this.http.post<LiveChatBundle>(`/api/public/chat/sessions/${encodeURIComponent(token)}/csat`, { rating, comment });
  }
}
