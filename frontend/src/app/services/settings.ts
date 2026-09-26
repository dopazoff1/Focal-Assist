import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MeSettings {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  timeZone: string;
  uiLanguage?: string;
  desktopNotificationsEnabled?: boolean;
  soundNotificationsEnabled?: boolean;
  hasProfilePhoto?: boolean;
  profilePhotoUpdatedAt?: string;
}

export interface JiraUserSettings {
  baseUrl: string;
  username: string;
  password: string;
  projectKey: string;
  issueTypeName: string;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly API_URL = '/api/settings';

  constructor(private http: HttpClient) {}

  getMe(): Observable<MeSettings> {
    return this.http.get<MeSettings>(`${this.API_URL}/me`);
  }

  updateTimeZone(timeZone: string): Observable<MeSettings & { saved: boolean }> {
    return this.http.put<MeSettings & { saved: boolean }>(`${this.API_URL}/me/timezone`, { timeZone });
  }

  updateMyPreferences(payload: {
    firstName: string;
    lastName: string;
    uiLanguage: string;
    desktopNotificationsEnabled: boolean;
    soundNotificationsEnabled: boolean;
  }): Observable<MeSettings & { saved: boolean }> {
    return this.http.put<MeSettings & { saved: boolean }>(`${this.API_URL}/me/preferences`, payload);
  }

  updateMyPassword(currentPassword: string, newPassword: string): Observable<{ saved: boolean }> {
    return this.http.put<{ saved: boolean }>(`${this.API_URL}/me/password`, { currentPassword, newPassword });
  }

  getMyJiraSettings(): Observable<JiraUserSettings> {
    return this.http.get<JiraUserSettings>(`${this.API_URL}/me/jira`);
  }

  updateMyJiraSettings(payload: JiraUserSettings): Observable<JiraUserSettings & { saved: boolean }> {
    return this.http.put<JiraUserSettings & { saved: boolean }>(`${this.API_URL}/me/jira`, payload);
  }

  uploadMyProfilePhoto(file: Blob): Observable<MeSettings & { saved: boolean }> {
    const form = new FormData();
    form.append('file', file, 'profile-photo.jpg');
    return this.http.post<MeSettings & { saved: boolean }>(`${this.API_URL}/me/profile-photo`, form);
  }

  deleteMyProfilePhoto(): Observable<MeSettings & { saved: boolean }> {
    return this.http.delete<MeSettings & { saved: boolean }>(`${this.API_URL}/me/profile-photo`);
  }

  getProfilePhoto(userId: number | 'me', size: 'light' | 'original' = 'light'): Observable<Blob> {
    const target = userId === 'me' ? 'me' : `users/${userId}`;
    return this.http.get(`${this.API_URL}/${target}/profile-photo?size=${size}`, {
      responseType: 'blob'
    });
  }
}

