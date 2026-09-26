import { Component } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet
} from '@angular/router';
import { Header } from "./components/header/header";
import { ThemeService } from './services/theme';
import { NgIf } from '@angular/common';
import { Subscription } from 'rxjs';
import { AccountAccessMonitorService } from './services/account-access-monitor';

@Component({
  selector: 'app-root',
  imports: [Header, RouterOutlet, NgIf],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  isV2Route = true;
  isNavigating = false;
  accountDeactivatedBlocked = false;
  private navStartedAt = 0;
  private currentPath = '';
  private shouldAnimateCurrentNav = false;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly showDelayMs = 80;
  private readonly minVisibleMs = 220;
  private accountBlockedSub?: Subscription;

  constructor(
    private themeService: ThemeService,
    private router: Router,
    private accountAccessMonitor: AccountAccessMonitorService
  ) {
    this.themeService.initializeTheme();
    const initialUrl = (typeof window !== 'undefined' && typeof window.location !== 'undefined')
      ? window.location.pathname
      : this.router.url;
    this.currentPath = this.normalizePath(initialUrl);
    this.isV2Route = this.isHeaderHiddenRoute(initialUrl);
    this.router.events
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          const nextPath = this.normalizePath(event.url || '');
          this.shouldAnimateCurrentNav = nextPath !== this.currentPath;
          if (this.shouldAnimateCurrentNav) {
            this.startNavigationTransition();
          }
          return;
        }
        if (event instanceof NavigationEnd) {
          this.currentPath = this.normalizePath(event.urlAfterRedirects || event.url || '');
          this.isV2Route = this.isHeaderHiddenRoute(event.urlAfterRedirects);
          this.accountAccessMonitor.syncMonitoringState();
          if (this.shouldAnimateCurrentNav) {
            this.endNavigationTransition();
          } else {
            this.isNavigating = false;
          }
          this.shouldAnimateCurrentNav = false;
          return;
        }
        if (event instanceof NavigationCancel || event instanceof NavigationError) {
          if (this.shouldAnimateCurrentNav) {
            this.endNavigationTransition();
          } else {
            this.isNavigating = false;
          }
          this.shouldAnimateCurrentNav = false;
        }
      });

    this.accountBlockedSub = this.accountAccessMonitor.blocked$.subscribe((blocked) => {
      this.accountDeactivatedBlocked = blocked;
    });
    this.accountAccessMonitor.syncMonitoringState();
  }

  ngOnDestroy(): void {
    this.accountBlockedSub?.unsubscribe();
  }

  private isHeaderHiddenRoute(url: string): boolean {
    const normalized = this.normalizePath(url);
    return normalized === ''
      || normalized === '/'
      || normalized.startsWith('/marketing')
      || normalized.startsWith('/pricing')
      || normalized.startsWith('/chat')
      || normalized.startsWith('/v2')
      || normalized.startsWith('/v3')
      || normalized.startsWith('/login');
  }

  private normalizePath(url: string): string {
    return (url || '').split('?')[0].split('#')[0];
  }

  private startNavigationTransition(): void {
    this.navStartedAt = Date.now();
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    this.showTimer = setTimeout(() => {
      this.isNavigating = true;
      this.showTimer = null;
    }, this.showDelayMs);
  }

  private endNavigationTransition(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    if (!this.isNavigating) {
      return;
    }

    const elapsed = Date.now() - this.navStartedAt;
    const remaining = Math.max(0, this.minVisibleMs - elapsed);
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
    this.hideTimer = setTimeout(() => {
      this.isNavigating = false;
      this.hideTimer = null;
    }, remaining);
  }

  refreshAfterDeactivation(): void {
    this.accountAccessMonitor.acknowledgeAndRefresh();
  }
}
