import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of, switchMap, tap } from 'rxjs';

export type EscalationPriority = 'low' | 'medium' | 'high' | 'critical';
export type EscalationStatus =
  | 'open'
  | 'escalated'
  | 'investigating'
  | 'waiting_l1'
  | 'resolved'
  | 'closed'
  | 'duplicate_closed';
export type EscalationLevel = 'L1' | 'L2' | 'DONE';

export interface EscalationTicket {
  id: number;
  key: string;
  title: string;
  description: string;
  customerEmail: string;
  clientId: string;
  issueTypes: string[];
  priority: EscalationPriority;
  status: EscalationStatus;
  level: EscalationLevel;
  createdByUserId: number;
  createdByName: string;
  createdByRole: string;
  l2AssigneeUserId: number | null;
  l2AssigneeName: string;
  escalationReason: string;
  escalatedAt: string | null;
  jiraIssueKey: string;
  jiraIssueUrl: string;
  jiraStatus: string;
  jiraSyncedAt: string | null;
  duplicateOfTicketId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationComment {
  id: number;
  ticketId: number;
  authorUserId: number;
  authorName: string;
  authorRole: string;
  source: 'internal' | 'jira';
  body: string;
  createdAt: string;
}

export interface EscalationUserContext {
  userId: number;
  fullName: string;
  role: string;
}

export interface L2ClaimResult {
  ok: boolean;
  ticket: EscalationTicket | null;
  error?: string;
}

export interface EscalationL2User {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
}

interface EscalationStore {
  tickets: EscalationTicket[];
  commentsByTicket: Record<string, EscalationComment[]>;
}

interface EscalationWorkspaceResponse {
  tickets?: EscalationTicket[];
  commentsByTicket?: Record<string, EscalationComment[]>;
}

@Injectable({ providedIn: 'root' })
export class FlowdeskEscalationService {
  private readonly apiUrl = '/api/escalations';
  private readonly state$ = new BehaviorSubject<EscalationStore>({
    tickets: [],
    commentsByTicket: {}
  });

  readonly tickets$ = this.state$.asObservable().pipe(map(state => state.tickets));

  constructor(private http: HttpClient) {}

  get tickets(): EscalationTicket[] {
    return this.state$.value.tickets;
  }

  isL1Role(role: string): boolean {
    const normalized = (role || '').toString().trim().toUpperCase();
    return normalized === 'AGENT' || normalized === 'ROLE_AGENT' || normalized === 'L1' || normalized === 'ROLE_L1' || normalized === '2' || normalized === 'ROLE_2';
  }

  isL2Role(role: string): boolean {
    const normalized = (role || '').toString().trim().toUpperCase();
    if (!normalized) return false;
    return !this.isL1Role(normalized);
  }

  loadWorkspace(): Observable<EscalationStore> {
    return this.http.get<EscalationWorkspaceResponse>(`${this.apiUrl}/workspace`).pipe(
      map(payload => this.normalizeStore(payload)),
      tap(store => this.state$.next(store))
    );
  }

  listL2Users(): Observable<EscalationL2User[]> {
    return this.http.get<EscalationL2User[]>(`${this.apiUrl}/l2-users`);
  }

  createTicket(
    input: {
      title: string;
      description?: string;
      customerEmail?: string;
      clientId?: string;
      issueTypes?: string[];
      priority?: EscalationPriority;
    },
    _actor: EscalationUserContext
  ): Observable<EscalationTicket> {
    return this.withRefresh(
      this.http.post<EscalationTicket>(`${this.apiUrl}/tickets`, {
        title: (input.title || '').trim(),
        description: (input.description || '').trim(),
        customerEmail: (input.customerEmail || '').trim(),
        clientId: (input.clientId || '').trim(),
        issueTypes: Array.isArray(input.issueTypes) ? input.issueTypes : [],
        priority: input.priority || 'medium'
      })
    );
  }

  escalateTicket(
    ticketId: number,
    payload: { reason: string; l2AssigneeUserId?: number | null; l2AssigneeName?: string },
    _actor: EscalationUserContext
  ): Observable<EscalationTicket> {
    return this.withRefresh(
      this.http.post<EscalationTicket>(`${this.apiUrl}/tickets/${ticketId}/escalate`, {
        reason: (payload.reason || '').trim(),
        l2AssigneeUserId: payload.l2AssigneeUserId ?? null,
        l2AssigneeName: (payload.l2AssigneeName || '').trim()
      })
    );
  }

  updateStatus(
    ticketId: number,
    status: EscalationStatus,
    _actor: EscalationUserContext
  ): Observable<EscalationTicket> {
    return this.withRefresh(
      this.http.put<EscalationTicket>(`${this.apiUrl}/tickets/${ticketId}/status`, { status })
    );
  }

  addComment(
    ticketId: number,
    body: string,
    _actor: EscalationUserContext,
    source: 'internal' | 'jira' = 'internal'
  ): Observable<EscalationComment> {
    return this.withRefresh(
      this.http.post<EscalationComment>(`${this.apiUrl}/tickets/${ticketId}/comments`, {
        body: (body || '').trim(),
        source
      })
    );
  }

  assignL2(
    ticketId: number,
    payload: { l2AssigneeUserId?: number | null; l2AssigneeName?: string },
    _actor: EscalationUserContext
  ): Observable<EscalationTicket> {
    return this.withRefresh(
      this.http.put<EscalationTicket>(`${this.apiUrl}/tickets/${ticketId}/assign-l2`, {
        l2AssigneeUserId: payload.l2AssigneeUserId ?? null,
        l2AssigneeName: (payload.l2AssigneeName || '').trim()
      })
    );
  }

  claimForL2(ticketId: number, _actor: EscalationUserContext): Observable<L2ClaimResult> {
    return this.withRefresh(
      this.http.post<L2ClaimResult>(`${this.apiUrl}/tickets/${ticketId}/claim`, {})
    );
  }

  linkJiraIssue(
    ticketId: number,
    patch: { jiraIssueKey?: string; jiraIssueUrl?: string; jiraStatus?: string; jiraSyncedAt?: string | null }
  ): Observable<EscalationTicket> {
    return this.withRefresh(
      this.http.put<EscalationTicket>(`${this.apiUrl}/tickets/${ticketId}/jira`, {
        jiraIssueKey: (patch.jiraIssueKey || '').trim(),
        jiraIssueUrl: (patch.jiraIssueUrl || '').trim(),
        jiraStatus: (patch.jiraStatus || '').trim(),
        jiraSyncedAt: patch.jiraSyncedAt ?? null
      })
    );
  }

  updateJiraStatus(ticketId: number, jiraStatus: string): Observable<EscalationTicket> {
    return this.withRefresh(
      this.http.put<EscalationTicket>(`${this.apiUrl}/tickets/${ticketId}/jira-status`, {
        jiraStatus: (jiraStatus || '').trim()
      })
    );
  }

  commentsForTicket(ticketId: number): EscalationComment[] {
    const key = String(ticketId);
    const list = this.state$.value.commentsByTicket[key] || [];
    return [...list].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }

  findByClientId(clientId: string): EscalationTicket[] {
    const normalized = (clientId || '').toString().trim().toLowerCase();
    if (!normalized) return [];
    return this.tickets
      .filter(ticket => (ticket.clientId || '').toLowerCase() === normalized)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }

  closeAsDuplicate(
    ticketId: number,
    originalTicketId: number,
    _actor: EscalationUserContext,
    note?: string
  ): Observable<EscalationTicket> {
    return this.withRefresh(
      this.http.post<EscalationTicket>(`${this.apiUrl}/tickets/${ticketId}/close-duplicate`, {
        originalTicketId,
        note: (note || '').trim()
      })
    );
  }

  private withRefresh<T>(request$: Observable<T>): Observable<T> {
    return request$.pipe(
      switchMap(result =>
        this.loadWorkspace().pipe(
          map(() => result)
        )
      )
    );
  }

  private normalizeStore(payload: EscalationWorkspaceResponse | null | undefined): EscalationStore {
    const tickets = Array.isArray(payload?.tickets) ? payload!.tickets : [];
    const commentsByTicket = payload?.commentsByTicket && typeof payload.commentsByTicket === 'object'
      ? payload.commentsByTicket
      : {};
    return { tickets, commentsByTicket };
  }
}

