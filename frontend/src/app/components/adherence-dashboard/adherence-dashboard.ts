import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { PresenceService, PresenceStatusHistory } from '../../services/presence';
import { StaffService, StaffUser } from '../../services/staff';
import { AuthService } from '../../services/auth';
import { TeamLinksService } from '../../services/team-links';

type PeriodPreset = 'today' | '7d' | '30d' | 'custom';

interface AgentAdherenceRow {
  userId: number;
  userName: string;
  role: string;
  currentStatus: string;
  onlineMinutes: number;
  wrapupMinutes: number;
  productiveMinutes: number;
  availableMinutes: number;
  offlineMinutes: number;
  awayMinutes: number;
  breakMinutes: number;
  adherencePercent: number;
  occupancyPercent: number;
  transitions: number;
}

@Component({
  selector: 'app-adherence-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './adherence-dashboard.html',
  styleUrls: ['./adherence-dashboard.css']
})
export class AdherenceDashboard implements OnInit {
  readonly productiveStatuses = new Set(['ONLINE', 'WRAPUP']);
  readonly availableStatuses = new Set(['ONLINE', 'WRAPUP', 'AWAY', 'BREAK']);
  readonly trackedStatuses = ['ONLINE', 'WRAPUP', 'AWAY', 'BREAK', 'OFFLINE'];

  periodPreset: PeriodPreset = 'today';
  customStart = '';
  customEnd = '';

  loading = false;
  error = '';

  windowStart!: Date;
  windowEnd!: Date;
  monitoredMinutes = 0;

  rows: AgentAdherenceRow[] = [];
  timelineByUser: Record<number, PresenceStatusHistory[]> = {};
  selectedAgentId: number | null = null;

  projectAdherence = 0;
  projectOccupancy = 0;
  totalAgents = 0;
  activeAgents = 0;
  averageTransitions = 0;

  constructor(
    private staffService: StaffService,
    private presenceService: PresenceService,
    private auth: AuthService,
    private teamLinksService: TeamLinksService
  ) {}

  ngOnInit(): void {
    this.applyPresetDates();
    this.loadDashboard();
  }

  reload(): void {
    this.error = '';
    this.applyPresetDates();
    this.loadDashboard();
  }

  get selectedRow(): AgentAdherenceRow | null {
    if (!this.selectedAgentId) return null;
    return this.rows.find(r => r.userId === this.selectedAgentId) ?? null;
  }

  get selectedTimeline(): PresenceStatusHistory[] {
    if (!this.selectedAgentId) return [];
    return this.timelineByUser[this.selectedAgentId] ?? [];
  }

  get selectedTimelineSorted(): PresenceStatusHistory[] {
    return [...this.selectedTimeline].sort(
      (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
    );
  }

  selectAgent(userId: number): void {
    this.selectedAgentId = userId;
  }

  timelinePoint(index: number, total: number): number {
    if (total <= 1) return 0;
    return (index / (total - 1)) * 100;
  }

  timelineSegmentWidth(index: number, total: number): number {
    if (total <= 1 || index >= total - 1) return 0;
    return this.timelinePoint(index + 1, total) - this.timelinePoint(index, total);
  }

  statusY(status: string): number {
    const normalized = this.normalizeStatus(status);
    const map: Record<string, number> = {
      ONLINE: 10,
      WRAPUP: 30,
      AWAY: 55,
      BREAK: 75,
      OFFLINE: 95
    };
    return map[normalized] ?? 95;
  }

  onPresetChange(): void {
    this.error = '';
    this.applyPresetDates();
  }

  private applyPresetDates(): void {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    if (this.periodPreset === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (this.periodPreset === '7d') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (this.periodPreset === '30d') {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else {
      if (!this.customStart || !this.customEnd) {
        this.error = 'Pick both custom start and end date.';
        return;
      }
      const customStart = new Date(`${this.customStart}T00:00:00`);
      const customEnd = new Date(`${this.customEnd}T23:59:59`);
      if (Number.isNaN(customStart.getTime()) || Number.isNaN(customEnd.getTime()) || customStart > customEnd) {
        this.error = 'Invalid custom date range.';
        return;
      }
      start = customStart;
      end.setTime(customEnd.getTime());
    }

    this.windowStart = start;
    this.windowEnd = end;
    this.monitoredMinutes = Math.max(0, (this.windowEnd.getTime() - this.windowStart.getTime()) / 60000);
  }

  private loadDashboard(): void {
    if (this.error || !this.windowStart || !this.windowEnd) {
      return;
    }

    this.loading = true;
    this.staffService.listUsers()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (users) => {
          const candidateUsers = users
            .filter(u => u.active)
            .filter(u => this.isAgentRole(u.role));

          this.scopeUsersForViewer(candidateUsers).subscribe({
            next: (scopedUsers) => {
              this.totalAgents = scopedUsers.length;
              if (scopedUsers.length === 0) {
                this.rows = [];
                this.timelineByUser = {};
                this.selectedAgentId = null;
                this.computeProjectSummary();
                return;
              }

              forkJoin(
                scopedUsers.map(user =>
                  this.presenceService.getTimeline(user.id).pipe(catchError(() => of([] as PresenceStatusHistory[])))
                )
              ).subscribe({
                next: (allTimelines) => {
                  this.rows = scopedUsers
                    .map((user, index) => this.computeAgentAdherence(user, allTimelines[index] || []))
                    .sort((a, b) => b.adherencePercent - a.adherencePercent);
                  this.timelineByUser = {};
                  scopedUsers.forEach((user, index) => {
                    this.timelineByUser[user.id] = allTimelines[index] || [];
                  });
                  if (!this.selectedAgentId || !this.rows.some(r => r.userId === this.selectedAgentId)) {
                    this.selectedAgentId = this.rows[0]?.userId ?? null;
                  }
                  this.computeProjectSummary();
                },
                error: () => {
                  this.error = 'Failed to load adherence timelines.';
                }
              });
            },
            error: () => {
              this.error = 'Failed to scope agents for this role.';
            }
          });
        },
        error: (err) => {
          this.error = err?.error?.message || 'Failed to load agents.';
        }
      });
  }

  private computeAgentAdherence(user: StaffUser, timeline: PresenceStatusHistory[]): AgentAdherenceRow {
    const sorted = [...timeline]
      .map(item => ({ ...item, time: new Date(item.changedAt).getTime(), status: this.normalizeStatus(item.status) }))
      .filter(item => !Number.isNaN(item.time))
      .sort((a, b) => a.time - b.time);

    const startMs = this.windowStart.getTime();
    const endMs = this.windowEnd.getTime();

    const durations = new Map<string, number>();
    this.trackedStatuses.forEach(status => durations.set(status, 0));

    const latestBeforeStart = [...sorted].reverse().find(item => item.time <= startMs);
    let cursorStatus = latestBeforeStart?.status || this.normalizeStatus(user.status) || 'OFFLINE';
    let cursorTime = startMs;

    const inRangeEvents = sorted.filter(item => item.time > startMs && item.time < endMs);
    for (const event of inRangeEvents) {
      const segmentMinutes = Math.max(0, (event.time - cursorTime) / 60000);
      durations.set(cursorStatus, (durations.get(cursorStatus) || 0) + segmentMinutes);
      cursorTime = event.time;
      cursorStatus = event.status;
    }

    const trailingMinutes = Math.max(0, (endMs - cursorTime) / 60000);
    durations.set(cursorStatus, (durations.get(cursorStatus) || 0) + trailingMinutes);

    const productiveMinutes = (durations.get('ONLINE') || 0) + (durations.get('WRAPUP') || 0);
    const onlineMinutes = durations.get('ONLINE') || 0;
    const wrapupMinutes = durations.get('WRAPUP') || 0;
    const availableMinutes = productiveMinutes + (durations.get('AWAY') || 0) + (durations.get('BREAK') || 0);
    const offlineMinutes = durations.get('OFFLINE') || 0;
    const awayMinutes = durations.get('AWAY') || 0;
    const breakMinutes = durations.get('BREAK') || 0;

    const adherencePercent = availableMinutes > 0 ? (productiveMinutes / availableMinutes) * 100 : 0;
    const occupancyPercent = this.monitoredMinutes > 0 ? (availableMinutes / this.monitoredMinutes) * 100 : 0;

    return {
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      currentStatus: this.normalizeStatus(user.status),
      onlineMinutes,
      wrapupMinutes,
      productiveMinutes,
      availableMinutes,
      offlineMinutes,
      awayMinutes,
      breakMinutes,
      adherencePercent,
      occupancyPercent,
      transitions: inRangeEvents.length
    };
  }

  private computeProjectSummary(): void {
    if (this.rows.length === 0) {
      this.projectAdherence = 0;
      this.projectOccupancy = 0;
      this.activeAgents = 0;
      this.averageTransitions = 0;
      return;
    }

    const productiveTotal = this.rows.reduce((sum, row) => sum + row.productiveMinutes, 0);
    const availableTotal = this.rows.reduce((sum, row) => sum + row.availableMinutes, 0);
    const occupancyTotal = this.rows.reduce((sum, row) => sum + row.occupancyPercent, 0);
    const transitionTotal = this.rows.reduce((sum, row) => sum + row.transitions, 0);

    this.projectAdherence = availableTotal > 0 ? (productiveTotal / availableTotal) * 100 : 0;
    this.projectOccupancy = occupancyTotal / this.rows.length;
    this.activeAgents = this.rows.filter(row => row.availableMinutes > 0).length;
    this.averageTransitions = transitionTotal / this.rows.length;
  }

  statusClass(status: string): string {
    const normalized = this.normalizeStatus(status);
    return `status-${normalized.toLowerCase()}`;
  }

  adherenceClass(value: number): string {
    if (value >= 90) {
      return 'adherence-high';
    }
    if (value >= 75) {
      return 'adherence-medium';
    }
    return 'adherence-low';
  }

  formatMinutes(minutes: number): string {
    const rounded = Math.round(minutes);
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return `${h}h ${m}m`;
  }

  private normalizeStatus(status?: string | null): string {
    const normalized = (status || 'OFFLINE').toString().trim().toUpperCase();
    return this.trackedStatuses.includes(normalized) ? normalized : 'OFFLINE';
  }

  private isAgentRole(role?: string): boolean {
    const normalized = (role || '').toString().trim().toUpperCase();
    if (!normalized) {
      return true;
    }
    return !normalized.includes('ADMIN') && !normalized.includes('SUPERVISOR');
  }

  private scopeUsersForViewer(users: StaffUser[]) {
    const role = this.auth.getNormalizedRole();
    const me = this.auth.getUser();
    const meId = me?.id ?? 0;

    if (role === 'ADMIN' || role === 'HEAD_CS' || role === 'OPS') {
      return of(users);
    }
    if (role === 'TEAM_LEADER') {
      return this.teamLinksService.getAgentIdsForManager('TEAM_LEADER', meId).pipe(
        map(agentIds => {
          const allowed = new Set(
            (agentIds || [])
              .map(v => Number(v))
              .filter(v => Number.isFinite(v) && v > 0)
          );
          return users.filter(u => allowed.has(Number(u.id)));
        })
      );
    }
    if (role === 'QA') {
      return this.teamLinksService.getAgentIdsForManager('QA', meId).pipe(
        map(agentIds => {
          const allowed = new Set(
            (agentIds || [])
              .map(v => Number(v))
              .filter(v => Number.isFinite(v) && v > 0)
          );
          return users.filter(u => allowed.has(Number(u.id)));
        })
      );
    }
    return of(users);
  }
}
