import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PresenceUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  active: boolean;
}

export interface PresenceStatusHistory {
  id: number;
  userId: number;
  userName: string;
  status: string;
  changedAt: string;
  changedByEmail?: string;
  changeSource?: string;
  note?: string;
}

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private readonly apiUrl = '/api/presence';

  constructor(private http: HttpClient) {}

  getStatuses(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/statuses`);
  }

  getUsers(): Observable<PresenceUser[]> {
    return this.http.get<PresenceUser[]>(`${this.apiUrl}/users`);
  }

  getMe(): Observable<PresenceUser> {
    return this.http.get<PresenceUser>(`${this.apiUrl}/me`);
  }

  updateMyStatus(status: string): Observable<PresenceUser> {
    return this.http.put<PresenceUser>(`${this.apiUrl}/me`, { status });
  }

  getTimeline(userId?: number): Observable<PresenceStatusHistory[]> {
    const suffix = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.http.get<PresenceStatusHistory[]>(`${this.apiUrl}/timeline${suffix}`);
  }
}

