import { Component, DestroyRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common'; // keep this import
import { RouterModule, Router } from '@angular/router';
import {
  LucideArrowRight,
  LucideEye,
  LucideEyeOff,
  LucideLoaderCircle,
  LucideLockKeyhole,
  LucideUserRound
} from '@lucide/angular';
import { AuthResponse, AuthService, LoggedInUser } from '../../services/auth';
import { ThemeService } from '../../services/theme';
import { LoginScene } from './login-scene';
import { VisibleMotion } from '../../directives/visible-motion';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.css', './login-responsive.css'],
  standalone: true,
  imports: [
    LoginScene,
    VisibleMotion,
    FormsModule,
    NgIf,
    RouterModule,
    LucideArrowRight,
    LucideEye,
    LucideEyeOff,
    LucideLoaderCircle,
    LucideLockKeyhole,
    LucideUserRound
  ]
})
export class Login implements OnInit, OnDestroy {
  email: string = '';
  password: string = '';
  loginError: string = '';
  passwordVisible = false;
  isLoggingIn = false;
  isExiting = false;

  @ViewChild(LoginScene) private loginScene?: LoginScene;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private auth: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    // Force login page to the default theme without overriding saved preference.
    this.themeService.applyTheme('pro-glass-azure', false);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('marketing-v3-mode');
      document.body.classList.remove('v2-mode');
      document.body.classList.add('v3-mode');
      document.body.classList.add('login-v3-mode');
    }
  }

  ngOnDestroy(): void {
    // Restore persisted theme once leaving login.
    if (typeof document !== 'undefined') {
      document.body.classList.remove('marketing-v3-mode');
      document.body.classList.remove('login-v3-mode');
      document.body.classList.remove('v3-mode');
    }
    this.themeService.initializeTheme();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  login() {
    if (this.isLoggingIn) {
      return;
    }

    this.loginError = '';
    if (!this.email || !this.password) {
      this.loginError = 'Please fill in both fields';
      return;
    }

    this.isLoggingIn = true;
    this.auth.login(this.email, this.password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(
      (res: AuthResponse) => {
        if (res?.mfaSetupRequired && res.setupToken) {
          this.auth.beginMfaSetup(res.setupToken);
          this.finishLoginStep('/mfa-setup');
        } else if (res?.mfaRequired && res.challengeToken) {
          this.auth.beginMfaChallenge(res.challengeToken);
          this.finishLoginStep('/mfa-challenge');
        } else if (res?.token) {
          this.finishLogin(res as LoggedInUser);
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
          this.loginError = 'Unable to connect. Check your connection and try again.';
          return;
        }
        if (status >= 500) {
          this.loginError = 'Sign in is temporarily unavailable. Please try again shortly.';
          return;
        }
        if (status === 404) {
          this.loginError = 'Sign in is unavailable. Please contact your administrator.';
          return;
        }
        this.loginError = 'Login failed. Please try again.';
      }
    );
  }

  private finishLogin(user: LoggedInUser): void {
    const birthdayMessage = this.buildBirthdayPopupMessage(user);
    const navigateToWorkspace = () => {
      if (typeof document !== 'undefined') document.body.classList.add('workspace-entering');
      void this.router.navigate(['/']).then((navigated) => {
        this.isLoggingIn = false;
        if (!navigated && typeof document !== 'undefined') document.body.classList.remove('workspace-entering');
        if (navigated && birthdayMessage && typeof window !== 'undefined') window.alert(birthdayMessage);
      });
    };

    this.isExiting = true;
    if (this.loginScene) {
      this.loginScene.playExit(navigateToWorkspace);
    } else {
      navigateToWorkspace();
    }
  }

  private finishLoginStep(path: '/mfa-setup' | '/mfa-challenge'): void {
    this.isExiting = true;
    const navigate = () => {
      void this.router.navigate([path]).then(() => {
        this.isLoggingIn = false;
      });
    };
    if (this.loginScene) {
      this.loginScene.playExit(navigate);
    } else {
      navigate();
    }
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
