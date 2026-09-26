import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { PresenceService } from '../../services/presence';
import { SettingsService } from '../../services/settings';

@Component({
  selector: 'app-v2-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './v2-shell.html',
  styleUrls: ['./v2-shell.css']
})
export class V2Shell implements OnInit, OnDestroy {
  readonly fallbackStatuses = ['ONLINE', 'AWAY', 'WRAPUP', 'BREAK', 'OFFLINE'];
  availableStatuses: string[] = [...this.fallbackStatuses];
  selectedStatus = 'OFFLINE';
  statusSaving = false;
  timeZones: string[] = [];
  selectedTimeZone = '';
  timeZoneSaving = false;
  uiScaleMode: 'COMPACT' | 'CLASSIC' = 'CLASSIC';

  constructor(
    public auth: AuthService,
    private presenceService: PresenceService,
    private settingsService: SettingsService
  ) {}

  get canManageStaff(): boolean {
    return this.auth.hasAnyRole('ADMIN');
  }

  get canUseBuilders(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS');
  }

  get canManageArticles(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS');
  }

  get canManageTeams(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS', 'OPS');
  }

  get canViewAdherence(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'TEAM_LEADER', 'QA', 'HEAD_CS', 'OPS');
  }

  get canUseQaEvaluation(): boolean {
    return this.auth.hasAnyRole('QA', 'ADMIN', 'HEAD_CS', 'OPS');
  }

  get canUseFlowDesk(): boolean {
    return this.auth.hasAnyRole('AGENT', 'ADMIN', 'TEAM_LEADER', 'QA', 'HEAD_CS', 'OPS');
  }

  get canManageTraining(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS', 'OPS', 'TEAM_LEADER', 'QA');
  }

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.add('v2-mode');
    }
    this.initUiScale();
    this.selectedStatus = this.auth.getUserStatus();
    this.initTimeZones();
    this.loadPresenceMeta();
    this.loadSettings();
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('v2-mode');
    }
  }

  logout(): void {
    this.auth.logout();
  }

  updateMyStatus(): void {
    const next = this.selectedStatus || 'OFFLINE';
    this.statusSaving = true;
    this.presenceService.updateMyStatus(next)
      .pipe(finalize(() => this.statusSaving = false))
      .subscribe({
        next: (me) => {
          this.selectedStatus = me.status || next;
          this.auth.setUserStatus(this.selectedStatus);
        },
        error: () => {
          this.selectedStatus = this.auth.getUserStatus();
        }
      });
  }

  private loadPresenceMeta(): void {
    this.presenceService.getStatuses().subscribe({
      next: (statuses) => {
        if (Array.isArray(statuses) && statuses.length > 0) {
          this.availableStatuses = [...statuses].sort();
        }
      },
      error: () => {
        this.availableStatuses = [...this.fallbackStatuses];
      }
    });

    this.presenceService.getMe().subscribe({
      next: (me) => {
        this.selectedStatus = me.status || this.selectedStatus;
        this.auth.setUserStatus(this.selectedStatus);
      },
      error: () => {}
    });
  }

  updateMyTimeZone(): void {
    const tz = (this.selectedTimeZone || '').trim();
    this.timeZoneSaving = true;
    this.settingsService.updateTimeZone(tz)
      .pipe(finalize(() => this.timeZoneSaving = false))
      .subscribe({
        next: (res) => {
          this.selectedTimeZone = (res.timeZone || '').trim();
          this.auth.setTimeZone(this.selectedTimeZone);
        },
        error: () => {
          this.selectedTimeZone = this.auth.getTimeZone();
        }
      });
  }

  private loadSettings(): void {
    this.settingsService.getMe().subscribe({
      next: (me) => {
        const tz = (me?.timeZone || '').toString().trim();
        this.selectedTimeZone = tz || this.auth.getTimeZone() || '';
        this.auth.setTimeZone(this.selectedTimeZone);
      },
      error: () => {
        this.selectedTimeZone = this.auth.getTimeZone() || '';
      }
    });
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
      'America/Denver',
      'America/Los_Angeles',
      'Asia/Dubai',
      'Asia/Riyadh'
    ];

    const list = [...new Set([resolved, ...fallback].filter(Boolean))];
    this.timeZones = list;
    this.selectedTimeZone = this.auth.getTimeZone() || resolved || '';
  }

  updateUiScale(): void {
    this.applyUiScale(this.uiScaleMode);
  }

  private initUiScale(): void {
    this.applyUiScale('CLASSIC');
  }

  private applyUiScale(mode: 'COMPACT' | 'CLASSIC'): void {
    if (typeof document === 'undefined') return;
    // UI mode is locked to CLASSIC.
    this.uiScaleMode = 'CLASSIC';
    document.documentElement.classList.remove('ui-scale-compact');
  }
}
