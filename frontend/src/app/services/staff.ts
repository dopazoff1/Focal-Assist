import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StaffUser {
  id: number;
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  role: string;
  status: string;
  active: boolean;
  deactivationReason?: string | null;
  deactivatedAt?: string | null;
}

export interface StaffCreateRequest {
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  password: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly apiUrl = '/api/staff';

  constructor(private http: HttpClient) {}

  listUsers(): Observable<StaffUser[]> {
    return this.http.get<StaffUser[]>(this.apiUrl);
  }

  createUser(payload: StaffCreateRequest): Observable<StaffUser> {
    return this.http.post<StaffUser>(this.apiUrl, payload);
  }

  updateRole(userId: number, role: string): Observable<StaffUser> {
    return this.http.put<StaffUser>(`${this.apiUrl}/${userId}/role`, { role });
  }

  updateStatus(userId: number, status: string): Observable<StaffUser> {
    return this.http.put<StaffUser>(`${this.apiUrl}/${userId}/status`, { status });
  }

  deactivate(userId: number, reason: string): Observable<StaffUser> {
    return this.http.put<StaffUser>(`${this.apiUrl}/${userId}/deactivate`, { reason });
  }

  activate(userId: number): Observable<StaffUser> {
    return this.http.put<StaffUser>(`${this.apiUrl}/${userId}/activate`, {});
  }

  resetPassword(userId: number, password: string): Observable<StaffUser> {
    return this.http.put<StaffUser>(`${this.apiUrl}/${userId}/password`, { password });
  }
}

