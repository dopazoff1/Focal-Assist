import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, tap } from 'rxjs';

export interface LoggedInUser {
  token?: string;
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  role: number | string; // numeric role or string from API
  status?: string;
  timeZone?: string;
  hasProfilePhoto?: boolean;
  profilePhotoUpdatedAt?: string;
  password?: string;
}

export interface AuthResponse extends Partial<LoggedInUser> {
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
  challengeToken?: string;
  setupToken?: string;
  mfaConfigured?: boolean;
  backupCodes?: string[];
}

export interface MfaSetupResponse {
  account: string;
  issuer: string;
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  expiresAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = '/auth/login'; // backend login endpoint
  public loggedInUser!: LoggedInUser; // store the full logged-in user
  private pendingMfaSetupToken: string | null = null;
  private pendingMfaChallengeToken: string | null = null;

  constructor(private http: HttpClient, private router: Router) { }

  /** Login request to backend */
  login(email: string, password: string): Observable<AuthResponse> {
    if (typeof window === 'undefined') return of(null as any);

    return this.http.post<AuthResponse>(this.apiUrl, { email, password }).pipe(
      tap(user => {
        if (user?.token) {
          this.storeAuthenticatedUser(user as LoggedInUser);
        }
      })
    );
  }

  storeAuthenticatedUser(user: LoggedInUser): void {
    if (typeof window === 'undefined' || !user?.token) return;
    const persistedUser = { ...user } as LoggedInUser & { backupCodes?: string[] };
    delete persistedUser.backupCodes;
    this.loggedInUser = persistedUser;
    localStorage.setItem('user', JSON.stringify(persistedUser));
    localStorage.setItem('token', persistedUser.token!);
    localStorage.setItem('id', persistedUser.id!.toString());
    localStorage.setItem('firstName', persistedUser.firstName || '');
    localStorage.setItem('lastName', persistedUser.lastName || '');
    localStorage.setItem('email', persistedUser.email || '');
    localStorage.setItem('dob', persistedUser.dob || '');
    localStorage.setItem('role', persistedUser.role?.toString() || '');
    localStorage.setItem('status', persistedUser.status || 'OFFLINE');
    localStorage.setItem('timeZone', (persistedUser.timeZone || '').toString());
    localStorage.setItem('hasProfilePhoto', persistedUser.hasProfilePhoto ? '1' : '0');
    localStorage.setItem('profilePhotoUpdatedAt', (persistedUser.profilePhotoUpdatedAt || '').toString());
    localStorage.setItem('name', `${persistedUser.firstName || ''} ${persistedUser.lastName || ''}`.trim());
  }

  beginMfaSetup(token: string): void {
    this.pendingMfaSetupToken = token || null;
    this.pendingMfaChallengeToken = null;
  }

  beginMfaChallenge(token: string): void {
    this.pendingMfaChallengeToken = token || null;
    this.pendingMfaSetupToken = null;
  }

  getPendingMfaSetupToken(): string | null {
    return this.pendingMfaSetupToken;
  }

  getPendingMfaChallengeToken(): string | null {
    return this.pendingMfaChallengeToken;
  }

  clearPendingMfa(): void {
    this.pendingMfaSetupToken = null;
    this.pendingMfaChallengeToken = null;
  }

  startMfaSetup(token: string): Observable<MfaSetupResponse> {
    return this.http.post<MfaSetupResponse>('/auth/mfa/setup/start', { token });
  }

  confirmMfaSetup(token: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/auth/mfa/setup/confirm', { token, code });
  }

  verifyMfa(token: string, code?: string, backupCode?: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/auth/mfa/verify', { token, code, backupCode });
  }

  /** Logout user */
  logout(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('name');
    localStorage.removeItem('id');
    localStorage.removeItem('firstName');
    localStorage.removeItem('lastName');
    localStorage.removeItem('email');
    localStorage.removeItem('dob');
    localStorage.removeItem('password');
    localStorage.removeItem('role');
    localStorage.removeItem('status');
    localStorage.removeItem('timeZone');
    localStorage.removeItem('hasProfilePhoto');
    localStorage.removeItem('profilePhotoUpdatedAt');

    this.loggedInUser = undefined!;
    this.clearPendingMfa();
    this.router.navigate(['/login']);
  }

  /** Check if user is logged in */
  isLoggedIn(): boolean {
    if (typeof window === 'undefined') return false;
    const token = (localStorage.getItem('token') || '').trim();
    return !!token && token.toLowerCase() !== 'null' && token.toLowerCase() !== 'undefined';
  }

  /** Get logged-in user name (for compatibility with old code) */
  getUserName(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('name') || '';
  }

  /** Get full logged-in user object */
  getUser(): LoggedInUser | null {
    if (typeof window === 'undefined') return null;
    if (!this.loggedInUser) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) this.loggedInUser = JSON.parse(storedUser);
    }
    return this.loggedInUser || null;
  }

  /** Get numeric role from memory */
  getUserRole(): number | null {
    const user = this.getUser();
    if (!user) return null;

    // Convert string role from API to number if needed
    return typeof user.role === 'string' ? parseInt(user.role, 10) : user.role;
  }

  /** Get role from localStorage directly (like getUserName) */
  getUserRoleFromStorage(): number | null {
    if (typeof window === 'undefined') return null;
    const storedRole = localStorage.getItem('role');
    if (storedRole) {
      const parsed = parseInt(storedRole, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  setUserStatus(status: string): void {
    if (typeof window === 'undefined') return;
    const user = this.getUser();
    if (user) {
      user.status = status;
      localStorage.setItem('user', JSON.stringify(user));
    }
    localStorage.setItem('status', status);
  }

  getUserStatus(): string {
    if (typeof window === 'undefined') return 'OFFLINE';
    return localStorage.getItem('status') || this.getUser()?.status || 'OFFLINE';
  }

  getTimeZone(): string {
    if (typeof window === 'undefined') return '';
    const user = this.getUser();
    const fromUser = (user?.timeZone || '').toString().trim();
    if (fromUser) return fromUser;
    return (localStorage.getItem('timeZone') || '').toString().trim();
  }

  setTimeZone(timeZone: string): void {
    if (typeof window === 'undefined') return;
    const tz = (timeZone || '').toString().trim();
    const user = this.getUser();
    if (user) {
      user.timeZone = tz;
      localStorage.setItem('user', JSON.stringify(user));
    }
    localStorage.setItem('timeZone', tz);
  }

  setProfilePhotoMeta(hasProfilePhoto: boolean, profilePhotoUpdatedAt: string): void {
    if (typeof window === 'undefined') return;
    const user = this.getUser();
    const hasPhoto = !!hasProfilePhoto;
    const updatedAt = (profilePhotoUpdatedAt || '').toString();
    if (user) {
      user.hasProfilePhoto = hasPhoto;
      user.profilePhotoUpdatedAt = updatedAt;
      localStorage.setItem('user', JSON.stringify(user));
    }
    localStorage.setItem('hasProfilePhoto', hasPhoto ? '1' : '0');
    localStorage.setItem('profilePhotoUpdatedAt', updatedAt);
  }

  hasProfilePhoto(): boolean {
    if (typeof window === 'undefined') return false;
    const user = this.getUser();
    if (typeof user?.hasProfilePhoto === 'boolean') {
      return user.hasProfilePhoto;
    }
    return localStorage.getItem('hasProfilePhoto') === '1';
  }

  getProfilePhotoUpdatedAt(): string {
    if (typeof window === 'undefined') return '';
    const user = this.getUser();
    const fromUser = (user?.profilePhotoUpdatedAt || '').toString().trim();
    if (fromUser) return fromUser;
    return (localStorage.getItem('profilePhotoUpdatedAt') || '').toString().trim();
  }

  getNormalizedRole(): string {
    const user = this.getUser();
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('role') : '';
    const raw = (user?.role ?? storedRole ?? '').toString().trim().toUpperCase();
    if (!raw) return '';
    if (raw === '1' || raw === 'ROLE_ADMIN' || raw === 'ADMIN') return 'ADMIN';
    if (raw === '2' || raw === 'ROLE_AGENT' || raw === 'AGENT' || raw === 'ROLE_USER') return 'AGENT';
    if (raw === '3' || raw === 'ROLE_TEAM_LEADER' || raw === 'TEAM_LEADER' || raw === 'TL') return 'TEAM_LEADER';
    if (raw === '4' || raw === 'ROLE_QA' || raw === 'QA' || raw === 'QUALITY') return 'QA';
    if (raw === '5' || raw === 'ROLE_HEAD_CS' || raw === 'ROLE_HEAD_OF_CS' || raw === 'HEAD_CS' || raw === 'HCS') return 'HEAD_CS';
    if (raw === '6' || raw === 'ROLE_OPS' || raw === 'OPS') return 'OPS';
    return raw;
  }

  hasAnyRole(...roles: string[]): boolean {
    const normalized = this.getNormalizedRole();
    if (!normalized) return false;
    return roles.map(r => r.trim().toUpperCase()).includes(normalized);
  }
}

