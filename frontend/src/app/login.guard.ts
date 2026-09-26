import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './services/auth';

@Injectable({
  providedIn: 'root'
})
export class LoginGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Skip login-route redirect during SSR; enforce it in the browser.
    if (!isPlatformBrowser(this.platformId)) {
      return true;
    }

    if (this.auth.isLoggedIn()) {
      const requested = (state?.url || '').toLowerCase();
      const destination = requested.startsWith('/v5')
        ? '/v5/dashboard'
        : requested.startsWith('/sales')
          ? '/sales/dashboard'
          : requested.startsWith('/v4')
            ? '/v4/dashboard'
            : '/';
      this.router.navigate([destination]);
      return false;
    }

    return true;
  }
}
