import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { EscalationTicket } from './flowdesk-escalations';
import { JiraUserSettings, SettingsService } from './settings';

export interface JiraBridgeConfig {
  baseUrl: string;
  username: string;
  password: string;
  projectKey: string;
  issueTypeName: string;
}

export interface JiraTransition {
  id: string;
  name: string;
}

export interface JiraIssueDraftPayload {
  summary?: string;
  description?: string;
  projectKey?: string;
  issueTypeName?: string;
  priority?: string;
  customerEmail?: string;
  clientId?: string;
  escalationReason?: string;
}

interface JiraIssueCreateResponse {
  id: string;
  key: string;
  self?: string;
}

@Injectable({ providedIn: 'root' })
export class JiraBridgeService {
  private readonly apiUrl = '/api/jira';
  private readonly configSubject = new BehaviorSubject<JiraBridgeConfig>(this.defaultConfig());
  readonly config$ = this.configSubject.asObservable();

  constructor(
    private http: HttpClient,
    private settingsService: SettingsService
  ) {}

  get config(): JiraBridgeConfig {
    return this.configSubject.value;
  }

  loadConfig(): Observable<JiraBridgeConfig> {
    return this.settingsService.getMyJiraSettings().pipe(
      map(cfg => this.normalizeConfig(cfg)),
      tap(cfg => this.configSubject.next(cfg)),
      catchError(() => of(this.configSubject.value))
    );
  }

  saveConfig(patch: Partial<JiraBridgeConfig>): Observable<JiraBridgeConfig> {
    const merged = this.normalizeConfig({
      ...this.configSubject.value,
      ...patch
    });
    const payload: JiraUserSettings = {
      baseUrl: merged.baseUrl,
      username: merged.username,
      password: merged.password,
      projectKey: merged.projectKey,
      issueTypeName: merged.issueTypeName
    };
    return this.settingsService.updateMyJiraSettings(payload).pipe(
      map(cfg => this.normalizeConfig(cfg)),
      tap(cfg => this.configSubject.next(cfg))
    );
  }

  testConnection(): Observable<unknown> {
    return this.http.get(`${this.apiUrl}/test`);
  }

  createIssueFromTicket(ticket: EscalationTicket, draft?: JiraIssueDraftPayload): Observable<JiraIssueCreateResponse> {
    const payload = {
      key: ticket.key,
      title: ticket.title,
      summary: (draft?.summary || '').trim(),
      priority: (draft?.priority || ticket.priority || '').toString().trim(),
      createdByName: ticket.createdByName,
      createdByRole: ticket.createdByRole,
      customerEmail: (draft?.customerEmail || ticket.customerEmail || '').toString().trim(),
      clientId: (draft?.clientId || ticket.clientId || '').toString().trim(),
      escalationReason: (draft?.escalationReason || ticket.escalationReason || '').toString().trim(),
      description: (draft?.description || ticket.description || '').toString().trim(),
      projectKey: (draft?.projectKey || '').toString().trim(),
      issueTypeName: (draft?.issueTypeName || '').toString().trim()
    };

    return this.http.post<JiraIssueCreateResponse>(`${this.apiUrl}/issues/from-ticket`, payload);
  }

  getIssue(issueKey: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/issues/${encodeURIComponent(issueKey)}`);
  }

  getTransitions(issueKey: string): Observable<{ transitions: JiraTransition[] }> {
    return this.http.get<{ transitions: JiraTransition[] }>(`${this.apiUrl}/issues/${encodeURIComponent(issueKey)}/transitions`);
  }

  transitionIssue(issueKey: string, transitionId: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/issues/${encodeURIComponent(issueKey)}/transitions`, { transitionId });
  }

  addComment(issueKey: string, body: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/issues/${encodeURIComponent(issueKey)}/comments`, { body: (body || '').trim() });
  }

  browseUrl(issueKey: string): string {
    const base = this.normalizedBaseUrl();
    if (!base) return '';
    return `${base}/browse/${encodeURIComponent(issueKey)}`;
  }

  extractIssueStatus(issuePayload: any): string {
    const raw = issuePayload?.fields?.status?.name ?? issuePayload?.status?.name ?? '';
    return (raw || '').toString().trim();
  }

  private normalizeConfig(input: Partial<JiraBridgeConfig> | null | undefined): JiraBridgeConfig {
    return {
      baseUrl: (input?.baseUrl || '').toString().trim(),
      username: (input?.username || '').toString().trim(),
      password: (input?.password || '').toString(),
      projectKey: (input?.projectKey || '').toString().trim().toUpperCase(),
      issueTypeName: (input?.issueTypeName || 'Task').toString().trim() || 'Task'
    };
  }

  private normalizedBaseUrl(): string {
    return (this.config.baseUrl || '').toString().trim().replace(/\/+$/, '');
  }

  private defaultConfig(): JiraBridgeConfig {
    return {
      baseUrl: '',
      username: '',
      password: '',
      projectKey: '',
      issueTypeName: 'Task'
    };
  }
}
