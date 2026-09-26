import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface AppStateResponse<T> {
  key: string;
  value: T;
  updatedAt?: string;
  updatedByUserId?: number;
}

@Injectable({ providedIn: 'root' })
export class ServerStateService {
  private readonly apiBase = '/api/state';

  constructor(private http: HttpClient) {}

  loadState<T>(key: string): Observable<T | null> {
    const safeKey = encodeURIComponent((key || '').trim());
    return this.http.get<AppStateResponse<T>>(`${this.apiBase}/${safeKey}`).pipe(
      map(response => (response && Object.prototype.hasOwnProperty.call(response, 'value') ? response.value : null)),
      catchError(err => {
        const status = Number(err?.status || 0);
        if (status === 404) return of(null);
        throw err;
      })
    );
  }

  saveState<T>(key: string, value: T): Observable<void> {
    const safeKey = encodeURIComponent((key || '').trim());
    return this.http.put<AppStateResponse<T>>(`${this.apiBase}/${safeKey}`, { value }).pipe(
      map(() => void 0)
    );
  }
}
