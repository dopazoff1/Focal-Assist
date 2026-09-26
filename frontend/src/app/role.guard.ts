import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthService } from './services/auth';
import { AccessControlService } from './services/access-control';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private accessControl: AccessControlService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return true;
    }

    return this.accessControl.ensureLoaded().pipe(
      map(() => this.evaluateAccess(route)),
      catchError(() => of(this.evaluateAccess(route)))
    );
  }

  private evaluateAccess(route: ActivatedRouteSnapshot): boolean {
    const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];
    const requiredFeature = ((route.data?.['feature'] as string | undefined) || '').trim();
    const currentRole = this.auth.getNormalizedRole();
    const hasFeature = requiredFeature
      ? this.accessControl.hasFeatureAccess(currentRole, requiredFeature)
      : false;

    if (requiredFeature && hasFeature) {
      return true;
    }

    // If a route explicitly requires a feature, role fallback must not bypass it.
    if (requiredFeature && !hasFeature) {
      this.router.navigate(['/v3/home']);
      return false;
    }

    if (!allowedRoles.length) {
      if (!requiredFeature) return true;
      this.router.navigate(['/v3/home']);
      return false;
    }

    if (this.auth.hasAnyRole(...allowedRoles)) {
      return true;
    }

    this.router.navigate(['/v3/home']);
    return false;
  }
}
