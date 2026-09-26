import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class AccountAccessMonitorService implements OnDestroy {
  private readonly blockedSubject = new BehaviorSubject<boolean>(false);
  readonly blocked$ = this.blockedSubject.asObservable();

  private monitorSub?: Subscription;
  private readonly pollEveryMs = 15000;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  ngOnDestroy(): void {
    this.stopMonitor();
  }

  syncMonitoringState(): void {
    if (typeof window === 'undefined') return;

    if (!this.auth.isLoggedIn()) {
      this.stopMonitor();
      this.blockedSubject.next(false);
      return;
    }

    if (this.monitorSub) return;

    this.monitorSub = timer(0, this.pollEveryMs).pipe(
      switchMap(() =>
        this.http.get('/api/settings/me').pipe(
          catchError((error: HttpErrorResponse) => {
            this.handleHttpError('/api/settings/me', error);
            return of(null);
          })
        )
      )
    ).subscribe();
  }

  handleHttpError(url: string, error: HttpErrorResponse): void {
    if (!this.auth.isLoggedIn()) return;
    if (Number(error?.status || 0) !== 403) return;

    const requestUrl = (url || '').toLowerCase();
    const message = `${error?.error?.message || ''} ${error?.message || ''}`.toLowerCase();
    const isDeactivatedMessage = message.includes('deactivated');
    const isMeSettingsForbidden = requestUrl.includes('/api/settings/me');

    if (isDeactivatedMessage || isMeSettingsForbidden) {
      this.forceBlock();
    }
  }

  forceBlock(): void {
    this.blockedSubject.next(true);
    this.stopMonitor();
  }

  acknowledgeAndRefresh(): void {
    this.auth.logout();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  private stopMonitor(): void {
    this.monitorSub?.unsubscribe();
    this.monitorSub = undefined;
  }
}

