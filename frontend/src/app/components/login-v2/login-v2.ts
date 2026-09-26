import { Component, DestroyRef, HostListener, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgIf } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  LucideArrowRight, LucideEye, LucideEyeOff, LucideLoaderCircle,
  LucideLockKeyhole, LucideMousePointer2, LucideUserRound
} from '@lucide/angular';
import { AuthResponse, AuthService, LoggedInUser } from '../../services/auth';
import { ThemeService } from '../../services/theme';
import { VisibleMotion } from '../../directives/visible-motion';
import { LoginV2Game } from './login-v2-game';
import { LoginV2Scene } from './login-v2-scene';

const GAME_TRIGGER_WORD = 'kiwikiwikiwikiwi';

@Component({
  selector: 'app-login-v2',
  templateUrl: './login-v2.html',
  styleUrls: ['./login-v2.css'],
  standalone: true,
  imports: [
    LoginV2Scene,
    LoginV2Game,
    VisibleMotion,
    FormsModule,
    NgIf,
    RouterModule,
    LucideArrowRight,
    LucideEye,
    LucideEyeOff,
    LucideLoaderCircle,
    LucideLockKeyhole,
    LucideMousePointer2,
    LucideUserRound
  ]
})
export class LoginV2 implements OnInit, OnDestroy {
  email = '';
  password = '';
  loginError = '';
  passwordVisible = false;
  isLoggingIn = false;
  isExiting = false;
  isGameOpen = false;

  @ViewChild(LoginV2Scene) private scene?: LoginV2Scene;

  private readonly destroyRef = inject(DestroyRef);
  private typedWord = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.applyTheme('pro-glass-azure', false);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('marketing-v3-mode');
      document.body.classList.remove('v2-mode');
      document.body.classList.add('v3-mode');
      document.body.classList.add('login-v3-mode');
      document.body.classList.add('login-v2-mode');
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('marketing-v3-mode');
      document.body.classList.remove('login-v3-mode');
      document.body.classList.remove('login-v2-mode');
      document.body.classList.remove('v3-mode');
    }
    this.themeService.initializeTheme();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardWord(event: KeyboardEvent): void {
    if (this.isGameOpen) return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (/^[a-z0-9]$/i.test(event.key)) {
      this.typedWord = `${this.typedWord}${event.key.toLowerCase()}`.slice(-GAME_TRIGGER_WORD.length);
      if (this.typedWord === GAME_TRIGGER_WORD) {
        event.preventDefault();
        this.openGame();
      }
      return;
    }
    if (event.key === 'Backspace') {
      this.typedWord = this.typedWord.slice(0, -1);
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') this.typedWord = '';
  }

  openGame(): void {
    this.typedWord = '';
    this.isGameOpen = true;
  }

  closeGame(): void {
    this.typedWord = '';
    this.isGameOpen = false;
  }

  login(): void {
    if (this.isLoggingIn) return;
    this.typedWord = '';
    this.loginError = '';
    if (!this.email || !this.password) {
      this.loginError = 'Please fill in both fields';
      return;
    }

    this.isLoggingIn = true;
    this.auth.login(this.email, this.password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: AuthResponse) => {
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
        error: (err: HttpErrorResponse) => {
          this.isLoggingIn = false;
          const status = err?.status ?? 0;
          const apiMessage = (err?.error?.message || '').toString().toLowerCase();
          if (status === 401 || apiMessage.includes('invalid credentials')) {
            this.loginError = 'Incorrect email or password.';
          } else if (status === 403 && apiMessage.includes('deactivated')) {
            this.loginError = 'This account is deactivated. Please contact an administrator.';
          } else if (status === 403) {
            this.loginError = 'Access denied for this account. Please contact an administrator.';
          } else if (status === 0) {
            this.loginError = 'Unable to connect. Check your connection and try again.';
          } else if (status >= 500) {
            this.loginError = 'Sign in is temporarily unavailable. Please try again shortly.';
          } else if (status === 404) {
            this.loginError = 'Sign in is unavailable. Please contact your administrator.';
          } else {
            this.loginError = 'Login failed. Please try again.';
          }
        }
      });
  }

  private finishLogin(user: LoggedInUser): void {
    const birthdayMessage = this.buildBirthdayPopupMessage(user);
    const navigateToWorkspace = () => {
      if (typeof document !== 'undefined') document.body.classList.add('workspace-entering');
      void this.router.navigate(['/']).then(navigated => {
        this.isLoggingIn = false;
        if (!navigated && typeof document !== 'undefined') document.body.classList.remove('workspace-entering');
        if (navigated && birthdayMessage && typeof window !== 'undefined') window.alert(birthdayMessage);
      });
    };
    this.isExiting = true;
    if (this.scene) this.scene.playExit(navigateToWorkspace);
    else navigateToWorkspace();
  }

  private finishLoginStep(path: '/mfa-setup' | '/mfa-challenge'): void {
    this.isExiting = true;
    const navigate = () => void this.router.navigate([path]).then(() => { this.isLoggingIn = false; });
    if (this.scene) this.scene.playExit(navigate);
    else navigate();
  }

  private buildBirthdayPopupMessage(user: LoggedInUser): string | null {
    if (typeof window === 'undefined') return null;
    const dob = this.parseDob(user?.dob);
    if (!dob) return null;
    const today = new Date();
    if (today.getMonth() !== dob.getMonth() || today.getDate() !== dob.getDate()) return null;
    const uid = (user?.id ?? localStorage.getItem('id') ?? '').toString().trim() || 'unknown';
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const seenKey = `birthday_popup_seen_${uid}_${dayKey}`;
    if (localStorage.getItem(seenKey) === '1') return null;
    localStorage.setItem(seenKey, '1');
    return `Happy Birthday, ${(user?.firstName || '').toString().trim() || 'there'}! Wishing you a great day and an amazing year ahead.`;
  }

  private parseDob(raw: string | null | undefined): Date | null {
    const value = (raw || '').toString().trim();
    if (!value) return null;
    const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
