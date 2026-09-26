import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AccountAccessMonitorService } from '../services/account-access-monitor';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (typeof window === 'undefined') {
    return next(req);
  }

  const router = inject(Router);
  const accountAccessMonitor = inject(AccountAccessMonitorService);
  let token = (localStorage.getItem('token') || '').trim();
  if (!token) {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        token = (parsed?.token || '').toString().trim();
        if (token) {
          localStorage.setItem('token', token);
        }
      } catch {
        // Ignore malformed user payload and continue without auth header.
      }
    }
  }

  const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/');
  const isAbsoluteHttpUrl = /^https?:\/\//i.test(req.url);
  const sameOriginAbsoluteUrl = isAbsoluteHttpUrl && typeof window !== 'undefined' && req.url.startsWith(window.location.origin);
  const isExternalAbsoluteUrl = isAbsoluteHttpUrl && !sameOriginAbsoluteUrl;
  const alreadyHasAuthorization = req.headers.has('Authorization');
  const headers: Record<string, string> = {};

  if (!isExternalAbsoluteUrl && !req.headers.has('X-Request-Id')) {
    headers['X-Request-Id'] = createRequestId();
  }

  if (!isAuthEndpoint && token && !isExternalAbsoluteUrl && !alreadyHasAuthorization) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const requestToSend = Object.keys(headers).length
    ? req.clone({
        setHeaders: headers
      })
    : req;

  return next(requestToSend).pipe(
    catchError((error) => {
      const status = Number(error?.status || 0);
      const isLoginCall = req.url.includes('/auth/login') || req.url.includes('/auth/');
      if (!isLoginCall && status === 403) {
        accountAccessMonitor.handleHttpError(req.url, error);
      }
      // Only 401 should force a logout. 403 can be a normal "no permission" response.
      if (!isLoginCall && status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('id');
        localStorage.removeItem('firstName');
        localStorage.removeItem('lastName');
        localStorage.removeItem('email');
        localStorage.removeItem('dob');
        localStorage.removeItem('password');
        localStorage.removeItem('role');
        localStorage.removeItem('status');
        localStorage.removeItem('name');
        router.navigate(['/login'], { queryParams: { reason: 'session-expired' } });
      }
      return throwError(() => error);
    })
  );
};

function createRequestId(): string {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
