import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideArrowRight, LucideKeyRound, LucideLoaderCircle } from '@lucide/angular';
import { AuthResponse, AuthService, LoggedInUser } from '../../services/auth';
import { LoginScene } from '../login/login-scene';

@Component({
  selector: 'app-mfa-challenge',
  standalone: true,
  imports: [CommonModule, FormsModule, LoginScene, LucideArrowRight, LucideKeyRound, LucideLoaderCircle],
  templateUrl: './mfa-challenge.html',
  styleUrls: ['./mfa-auth.css']
})
export class MfaChallengeComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private challengeToken = '';
  code = '';
  backupCode = '';
  useBackupCode = false;
  isSubmitting = false;
  errorMessage = '';
  isExiting = false;

  @ViewChild(LoginScene) private mfaScene?: LoginScene;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (typeof document !== 'undefined') document.body.classList.add('mfa-mode');
    this.challengeToken = this.auth.getPendingMfaChallengeToken() || '';
    if (!this.challengeToken) void this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') document.body.classList.remove('mfa-mode');
  }

  submit(): void {
    const input = this.useBackupCode ? this.backupCode.trim() : this.code.trim();
    if (!input) {
      this.errorMessage = this.useBackupCode ? 'Enter a backup code.' : 'Enter the six-digit code from your authenticator app.';
      return;
    }
    if (!this.useBackupCode && !/^\d{6}$/.test(input)) {
      this.errorMessage = 'Enter the six-digit code from your authenticator app.';
      return;
    }
    this.isSubmitting = true;
    this.errorMessage = '';
    this.auth.verifyMfa(this.challengeToken, this.useBackupCode ? undefined : input, this.useBackupCode ? input : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response: AuthResponse) => {
          this.isExiting = true;
          const navigateToWorkspace = () => {
            this.auth.storeAuthenticatedUser(response as LoggedInUser);
            this.auth.clearPendingMfa();
            if (typeof document !== 'undefined') document.body.classList.add('workspace-entering');
            void this.router.navigate(['/']);
          };
          if (this.mfaScene) {
            this.mfaScene.playExit(navigateToWorkspace);
          } else {
            navigateToWorkspace();
          }
        },
        error: error => {
          this.isSubmitting = false;
          this.errorMessage = (error?.error?.message || 'That security code is not valid. Try again.').toString();
        }
      });
  }

  switchMethod(): void {
    this.useBackupCode = !this.useBackupCode;
    this.errorMessage = '';
    this.code = '';
    this.backupCode = '';
  }

  backToLogin(): void {
    this.auth.clearPendingMfa();
    void this.router.navigate(['/login']);
  }
}
