import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export type TeamManagerRole = 'TEAM_LEADER' | 'QA';

export interface TeamLinkRecord {
  managerRole: TeamManagerRole;
  managerId: number;
  agentId: number;
}

@Injectable({ providedIn: 'root' })
export class TeamLinksService {
  private readonly apiUrl = '/api/team-links';

  constructor(private http: HttpClient) {}

  getAll(): Observable<TeamLinkRecord[]> {
    return this.http.get<TeamLinkRecord[]>(this.apiUrl).pipe(
      map(rows => Array.isArray(rows) ? rows : []),
      catchError((err: any) => {
        const status = typeof err?.status === 'number' ? err.status : null;
        if (status === 401 || status === 403) {
          return of([] as TeamLinkRecord[]);
        }
        return throwError(() => err);
      })
    );
  }

  getAgentIdsForManager(managerRole: TeamManagerRole, managerId: number): Observable<number[]> {
    return this.getAll().pipe(
      map(rows => rows
        .filter(r => this.normalizeManagerRole((r as any).managerRole) === managerRole && Number((r as any).managerId) === Number(managerId))
        .map(r => Number((r as any).agentId))
        .filter(id => Number.isFinite(id) && id > 0)),
      map(ids => [...new Set(ids)])
    );
  }

  saveForManager(managerRole: TeamManagerRole, managerId: number, agentIds: number[]): Observable<TeamLinkRecord[]> {
    const payload = { managerRole, managerId, agentIds };
    return this.http.post<TeamLinkRecord[]>(`${this.apiUrl}/replace`, payload).pipe(
      catchError((err: any) => {
        if (this.isAuthError(err)) {
          return throwError(() => err);
        }
        return throwError(() => err);
      })
    );
  }

  saveForAgent(agentId: number, teamLeaderId: number | null, qaId: number | null): Observable<TeamLinkRecord[]> {
    const payload = { teamLeaderId, qaId };
    return this.http.post<TeamLinkRecord[]>(`${this.apiUrl}/agent/${agentId}/replace`, payload).pipe(
      catchError((err: any) => {
        if (this.isAuthError(err)) {
          return throwError(() => err);
        }
        return throwError(() => err);
      })
    );
  }

  private normalizeManagerRole(raw: unknown): TeamManagerRole | null {
    const value = String(raw ?? '').trim().toUpperCase().replace('ROLE_', '');
    if (value === 'TEAM_LEADER') return 'TEAM_LEADER';
    if (value === 'QA') return 'QA';
    return null;
  }

  private isAuthError(err: any): boolean {
    const status = typeof err?.status === 'number' ? err.status : null;
    return status === 401 || status === 403;
  }
}
