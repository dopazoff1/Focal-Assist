import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthResponse, AuthService, LoggedInUser } from '../../services/auth';
import { ThemeService } from '../../services/theme';

@Component({
  selector: 'app-v5-login',
  templateUrl: './v5-login.html',
  styleUrls: ['./v5-login.css'],
  standalone: true,
  imports: [FormsModule, NgIf, RouterModule]
})
export class V5LoginComponent implements OnInit, OnDestroy {
  email = '';
  password = '';
  loginError = '';
  passwordVisible = false;
  isLoggingIn = false;

  private readonly loginTransitionMs = 5000;
  private loginStartedAt = 0;
  private loginTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.applyTheme('pro-glass-azure', false);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('marketing-v3-mode');
      document.body.classList.remove('login-v3-mode');
      document.body.classList.remove('v2-mode');
      document.body.classList.remove('v3-mode');
      document.body.classList.remove('v4-mode');
      document.body.classList.remove('login-v4-mode');
      document.body.classList.add('v5-mode');
      document.body.classList.add('login-v5-mode');
    }
  }

  ngOnDestroy(): void {
    if (this.loginTimer) {
      clearTimeout(this.loginTimer);
      this.loginTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('login-v5-mode');
      document.body.classList.remove('v5-mode');
    }
    this.themeService.initializeTheme();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  login(): void {
    if (this.isLoggingIn) {
      return;
    }

    this.loginError = '';
    if (!this.email || !this.password) {
      this.loginError = 'Please fill in both fields';
      return;
    }

    this.isLoggingIn = true;
    this.loginStartedAt = Date.now();

    this.auth.login(this.email, this.password).subscribe(
      (res: AuthResponse) => {
        if (res?.mfaSetupRequired && res.setupToken) {
          this.auth.beginMfaSetup(res.setupToken);
          this.isLoggingIn = false;
          void this.router.navigate(['/mfa-setup']);
        } else if (res?.mfaRequired && res.challengeToken) {
          this.auth.beginMfaChallenge(res.challengeToken);
          this.isLoggingIn = false;
          void this.router.navigate(['/mfa-challenge']);
        } else if (res?.token) {
          this.finishLoginWithDelay(res as LoggedInUser);
        } else {
          this.isLoggingIn = false;
          this.loginError = 'Invalid email or password';
        }
      },
      (err: HttpErrorResponse) => {
        this.isLoggingIn = false;
        const status = err?.status ?? 0;
        const apiMessage = (err?.error?.message || '').toString().toLowerCase();
        if (status === 401 || apiMessage.includes('invalid credentials')) {
          this.loginError = 'Incorrect email or password.';
          return;
        }
        if (status === 403 && apiMessage.includes('deactivated')) {
          this.loginError = 'This account is deactivated. Please contact an administrator.';
          return;
        }
        if (status === 403) {
          this.loginError = 'Access denied for this account. Please contact an administrator.';
          return;
        }
        if (status === 0) {
          this.loginError = 'Login API is unreachable. Verify backend is running.';
          return;
        }
        if (status >= 500) {
          this.loginError = 'Login API is currently unavailable. Verify backend/proxy is running.';
          return;
        }
        if (status === 404) {
          this.loginError = 'Login endpoint not found. Verify backend routing for /auth/login.';
          return;
        }
        this.loginError = 'Login failed. Please try again.';
      }
    );
  }

  private finishLoginWithDelay(user: LoggedInUser): void {
    const elapsed = Date.now() - this.loginStartedAt;
    const remaining = Math.max(0, this.loginTransitionMs - elapsed);
    const birthdayMessage = this.buildBirthdayPopupMessage(user);

    if (this.loginTimer) {
      clearTimeout(this.loginTimer);
    }

    this.loginTimer = setTimeout(() => {
      this.isLoggingIn = false;
      this.loginTimer = null;
      void this.router.navigate(['/v5/dashboard']).then(() => {
        if (birthdayMessage && typeof window !== 'undefined') {
          setTimeout(() => window.alert(birthdayMessage), 260);
        }
      });
    }, remaining);
  }

  private buildBirthdayPopupMessage(user: LoggedInUser): string | null {
    if (typeof window === 'undefined') return null;

    const dob = this.parseDob(user?.dob);
    if (!dob) return null;

    const today = new Date();
    if (today.getMonth() !== dob.getMonth() || today.getDate() !== dob.getDate()) {
      return null;
    }

    const uid = (user?.id ?? localStorage.getItem('id') ?? '').toString().trim() || 'unknown';
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const seenKey = `birthday_popup_seen_${uid}_${dayKey}`;
    if (localStorage.getItem(seenKey) === '1') {
      return null;
    }
    localStorage.setItem(seenKey, '1');

    const firstName = (user?.firstName || '').toString().trim();
    const name = firstName || 'there';
    return `Happy Birthday, ${name}! Wishing you a great day and an amazing year ahead.`;
  }

  private parseDob(raw: string | null | undefined): Date | null {
    const value = (raw || '').toString().trim();
    if (!value) return null;

    const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
      const y = Number(ymd[1]);
      const m = Number(ymd[2]);
      const d = Number(ymd[3]);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
      return new Date(y, m - 1, d);
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}


