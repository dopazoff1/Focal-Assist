import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideArrowRight, LucideCheck, LucideClipboard, LucideDownload, LucideLoaderCircle } from '@lucide/angular';
import { AuthResponse, AuthService, LoggedInUser, MfaSetupResponse } from '../../services/auth';
import { LoginScene } from '../login/login-scene';

@Component({
  selector: 'app-mfa-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, LoginScene, LucideArrowRight, LucideCheck, LucideClipboard, LucideDownload, LucideLoaderCircle],
  templateUrl: './mfa-setup.html',
  styleUrls: ['./mfa-auth.css']
})
export class MfaSetupComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private setupToken = '';
  private completedUser: LoggedInUser | null = null;
  setup: MfaSetupResponse | null = null;
  code = '';
  backupCodes: string[] = [];
  backupCodesSaved = false;
  isLoading = true;
  isSubmitting = false;
  isComplete = false;
  errorMessage = '';
  copied = false;
  isExiting = false;

  @ViewChild(LoginScene) private mfaScene?: LoginScene;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (typeof document !== 'undefined') document.body.classList.add('mfa-mode');
    this.setupToken = this.auth.getPendingMfaSetupToken() || '';
    if (!this.setupToken) {
      void this.router.navigate(['/login']);
      return;
    }
    this.auth.startMfaSetup(this.setupToken).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: setup => {
        this.setup = setup;
        this.isLoading = false;
      },
      error: error => {
        this.isLoading = false;
        this.errorMessage = this.errorText(error, 'This setup session has expired. Sign in again to restart it.');
      }
    });
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') document.body.classList.remove('mfa-mode');
  }

  confirm(): void {
    if (this.isSubmitting || !/^\d{6}$/.test(this.code)) {
      this.errorMessage = 'Enter the six-digit code shown in your authenticator app.';
      return;
    }
    this.isSubmitting = true;
    this.errorMessage = '';
    this.auth.confirmMfaSetup(this.setupToken, this.code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: AuthResponse) => {
        this.completedUser = response as LoggedInUser;
        this.backupCodes = response.backupCodes || [];
        this.isComplete = true;
        this.isSubmitting = false;
      },
      error: error => {
        this.isSubmitting = false;
        this.errorMessage = this.errorText(error, 'That code was not accepted. Check the time on your phone and try again.');
      }
    });
  }

  copyBackupCodes(): void {
    const value = this.backupCodes.join('\n');
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => {
      this.copied = true;
      window.setTimeout(() => this.copied = false, 1800);
    });
  }

  downloadBackupCodes(): void {
    const file = new Blob([`Focal backup codes\n\n${this.backupCodes.join('\n')}\n`], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = 'focal-assist-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  continueToWorkspace(): void {
    if (!this.completedUser || !this.backupCodesSaved) return;
    this.isExiting = true;
    const navigateToWorkspace = () => {
      this.auth.storeAuthenticatedUser(this.completedUser!);
      this.auth.clearPendingMfa();
      if (typeof document !== 'undefined') document.body.classList.add('workspace-entering');
      void this.router.navigate(['/']);
    };
    if (this.mfaScene) {
      this.mfaScene.playExit(navigateToWorkspace);
    } else {
      navigateToWorkspace();
    }
  }

  private errorText(error: any, fallback: string): string {
    return (error?.error?.message || error?.message || fallback).toString();
  }
}
