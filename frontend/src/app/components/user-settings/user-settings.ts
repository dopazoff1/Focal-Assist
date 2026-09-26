import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth';
import { JiraBridgeService } from '../../services/jira-bridge';
import { SettingsService } from '../../services/settings';
import { I18nService } from '../../services/i18n';
import { UI_LANGUAGE_OPTIONS, UiLanguage } from '../../utils/locale';
import { FlowdeskEscalationService } from '../../services/flowdesk-escalations';

@Component({
  selector: 'app-user-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-settings.html',
  styleUrl: './user-settings.css'
})
export class UserSettingsComponent implements OnInit {
  savingProfile = false;
  savingSecurity = false;
  savingJira = false;
  message = '';
  error = '';

  timeZones: string[] = [];
  selectedTimeZone = '';
  languageOptions = UI_LANGUAGE_OPTIONS;
  selectedLanguage: UiLanguage = 'en';
  firstName = '';
  lastName = '';
  desktopNotificationsEnabled = true;
  soundNotificationsEnabled = true;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  jiraBaseUrl = '';
  jiraUsername = '';
  jiraPassword = '';
  jiraProjectKey = '';
  jiraIssueTypeName = 'Task';
  jiraTestMessage = '';

  constructor(
    public auth: AuthService,
    private settingsService: SettingsService,
    private i18n: I18nService,
    private jiraBridge: JiraBridgeService,
    private escalations: FlowdeskEscalationService
  ) {}

  ngOnInit(): void {
    this.selectedLanguage = this.i18n.language;
    this.initTimeZones();
    this.selectedTimeZone = this.auth.getTimeZone() || '';
    this.settingsService.getMe().subscribe({
      next: (me) => {
        const tz = (me.timeZone || '').toString().trim();
        if (tz) {
          this.selectedTimeZone = tz;
          this.auth.setTimeZone(tz);
        }
        this.firstName = (me.firstName || this.auth.getUser()?.firstName || '').toString();
        this.lastName = (me.lastName || this.auth.getUser()?.lastName || '').toString();
        const language = ((me.uiLanguage || this.i18n.language || 'en').toString().toLowerCase() as UiLanguage);
        this.selectedLanguage = language === 'fr' ? 'fr' : 'en';
        this.desktopNotificationsEnabled = me.desktopNotificationsEnabled !== false;
        this.soundNotificationsEnabled = me.soundNotificationsEnabled !== false;
      },
      error: () => {}
    });
    this.loadJiraConfig();
  }

  get userName(): string {
    const full = `${this.firstName} ${this.lastName}`.trim();
    return full || this.auth.getUserName() || 'Current User';
  }

  get userEmail(): string {
    return (this.auth.getUser()?.email || localStorage.getItem('email') || '').toString();
  }

  get userRole(): string {
    return this.auth.getNormalizedRole() || 'USER';
  }

  get canConfigureJira(): boolean {
    return this.escalations.isL2Role(this.userRole);
  }

  saveProfilePreferences(): void {
    this.clearFeedback();
    this.savingProfile = true;
    this.settingsService.updateMyPreferences({
      firstName: (this.firstName || '').trim(),
      lastName: (this.lastName || '').trim(),
      uiLanguage: this.selectedLanguage,
      desktopNotificationsEnabled: !!this.desktopNotificationsEnabled,
      soundNotificationsEnabled: !!this.soundNotificationsEnabled
    }).subscribe({
      next: () => {
        this.settingsService.updateTimeZone(this.selectedTimeZone || '')
          .pipe(finalize(() => this.savingProfile = false))
          .subscribe({
            next: (res) => {
              const tz = (res.timeZone || '').toString().trim();
              this.auth.setTimeZone(tz);
              this.selectedTimeZone = tz;
              this.i18n.setLanguage(this.selectedLanguage);
              this.syncAuthProfileName();
              this.message = 'Profile preferences updated.';
            },
            error: (err) => {
              this.error = err?.error?.message || 'Could not save timezone.';
            }
          });
      },
      error: (err) => {
        this.error = err?.error?.message || 'Could not save preferences.';
        this.savingProfile = false;
      }
    });
  }

  resetMyPassword(): void {
    this.clearFeedback();
    if (!this.currentPassword) {
      this.error = 'Current password is required.';
      return;
    }
    if (!this.newPassword || this.newPassword.length < 4) {
      this.error = 'Password must be at least 4 characters.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Password confirmation does not match.';
      return;
    }

    this.savingSecurity = true;
    this.settingsService.updateMyPassword(this.currentPassword, this.newPassword)
      .pipe(finalize(() => this.savingSecurity = false))
      .subscribe({
        next: () => {
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.message = 'Password updated.';
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not update password for this account.';
        }
      });
  }

  saveJiraSettings(): void {
    this.clearFeedback();
    this.savingJira = true;
    this.jiraBridge.saveConfig({
      baseUrl: this.jiraBaseUrl.trim(),
      username: this.jiraUsername.trim(),
      password: this.jiraPassword,
      projectKey: this.jiraProjectKey.trim().toUpperCase(),
      issueTypeName: this.jiraIssueTypeName.trim() || 'Task'
    })
      .pipe(finalize(() => this.savingJira = false))
      .subscribe({
        next: () => {
          this.message = 'Jira settings saved for this account.';
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not save Jira settings.';
        }
      });
  }

  testJiraSettings(): void {
    this.jiraTestMessage = '';
    this.savingJira = true;
    this.jiraBridge.testConnection()
      .pipe(finalize(() => this.savingJira = false))
      .subscribe({
        next: () => {
          this.jiraTestMessage = 'Jira connection successful.';
        },
        error: (err) => {
          this.jiraTestMessage = err?.error?.message || err?.message || 'Jira connection failed.';
        }
      });
  }

  private loadJiraConfig(): void {
    this.jiraBridge.loadConfig().subscribe({
      next: (cfg) => {
        this.jiraBaseUrl = cfg.baseUrl || '';
        this.jiraUsername = cfg.username || '';
        this.jiraPassword = cfg.password || '';
        this.jiraProjectKey = cfg.projectKey || '';
        this.jiraIssueTypeName = cfg.issueTypeName || 'Task';
      },
      error: () => {}
    });
  }

  private clearFeedback(): void {
    this.message = '';
    this.error = '';
  }

  private syncAuthProfileName(): void {
    const user = this.auth.getUser();
    if (!user) return;
    user.firstName = (this.firstName || '').trim();
    user.lastName = (this.lastName || '').trim();
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('firstName', user.firstName || '');
    localStorage.setItem('lastName', user.lastName || '');
    localStorage.setItem('name', `${user.firstName || ''} ${user.lastName || ''}`.trim());
  }

  private initTimeZones(): void {
    const resolved = typeof Intl !== 'undefined' && Intl.DateTimeFormat
      ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '')
      : '';
    const fallback = [
      'Africa/Casablanca',
      'Europe/Paris',
      'Europe/London',
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Los_Angeles',
      'Asia/Dubai',
      'Asia/Riyadh'
    ];
    this.timeZones = [...new Set([resolved, ...fallback].filter(Boolean))];
  }
}
