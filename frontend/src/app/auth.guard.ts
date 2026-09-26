import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './services/auth'; 

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private auth: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Skip auth redirect during SSR; enforce it in the browser.
    if (!isPlatformBrowser(this.platformId)) {
      return true;
    }

    if (this.auth.isLoggedIn()) {
      return true;
    }

    const nextUrl = (state?.url || '').toLowerCase();
    const loginUrl = nextUrl.startsWith('/v5')
      ? '/v5/login'
      : nextUrl.startsWith('/sales')
        ? '/sales/login'
        : nextUrl.startsWith('/v4')
          ? '/v4/login'
          : '/login';
    this.router.navigate([loginUrl]);
    return false;
  }
}
