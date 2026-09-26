import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, finalize, forkJoin, map, Observable, of } from 'rxjs';
import { AuthService } from '../../services/auth';
import { StaffService, StaffUser } from '../../services/staff';
import { TeamLinksService, TeamManagerRole } from '../../services/team-links';
import { TrainingAssignment, TrainingCourse, TrainingLessonType, TrainingProgressState, TrainingService } from '../../services/training';

interface AnalyticsRow {
  userId: number;
  name: string;
  email: string;
  mandatory: boolean;
  dueAt: string | null;
  state: TrainingProgressState;
  progressPercent: number;
  lastSeenAt: string | null;
  completedAt: string | null;
  timeSpentMs: number;
}

interface StepRow {
  moduleTitle: string;
  lessonId: number;
  lessonTitle: string;
  type: TrainingLessonType;
  completed: boolean;
  timeSpentMs: number;
}

@Component({
  selector: 'app-training-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './training-analytics.html',
  styleUrls: ['./training-analytics.css']
})
export class TrainingAnalytics implements OnInit {
  selectedCourseId: number | null = null;
  selectedCourseId$ = new BehaviorSubject<number | null>(null);
  private readonly scopeIds$ = new BehaviorSubject<Set<number> | null>(null);
  expandedUserId: number | null = null;
  private readonly expandedUserId$ = new BehaviorSubject<number | null>(null);

  agents: StaffUser[] = [];
  agentById = new Map<number, StaffUser>();
  agentsLoading = false;
  agentsError = '';
  agentsNotice = '';

  readonly courses$: Observable<TrainingCourse[]>;
  readonly rows$: Observable<AnalyticsRow[]>;
  readonly metrics$: Observable<{ assigned: number; completed: number; overdue: number; avgProgress: number }>;
  readonly expandedSteps$: Observable<StepRow[]>;

  constructor(
    public auth: AuthService,
    private training: TrainingService,
    private staff: StaffService,
    private teamLinks: TeamLinksService
  ) {
    this.courses$ = this.training.courses$.pipe(
      map(rows => [...rows].filter(c => c.status !== 'ARCHIVED').sort((a, b) => a.title.localeCompare(b.title)))
    );

    this.rows$ = combineLatest([this.selectedCourseId$, this.scopeIds$, this.training.assignments$, this.training.progress$, this.training.courses$]).pipe(
      map(([courseId, scopeIds, assignments]) => {
        if (!courseId) return [];
        const scoped = (assignments || []).filter(a => a.courseId === courseId);
        if (scopeIds && scopeIds.size > 0) {
          return scoped.filter(a => scopeIds.has(Number(a.userId)));
        }
        if (scopeIds && scopeIds.size === 0) {
          return [];
        }
        return scoped;
      }),
      map((assignments: TrainingAssignment[]) => this.rowsForAssignments(assignments))
    );

    this.metrics$ = this.rows$.pipe(
      map(rows => {
        if (!rows.length) return { assigned: 0, completed: 0, overdue: 0, avgProgress: 0 };
        const assigned = rows.length;
        const completed = rows.filter(r => r.state === 'COMPLETED').length;
        const overdue = rows.filter(r => !!r.dueAt && new Date(r.dueAt).getTime() < Date.now() && r.state !== 'COMPLETED').length;
        const avgProgress = Math.round(rows.reduce((sum, r) => sum + r.progressPercent, 0) / rows.length);
        return { assigned, completed, overdue, avgProgress };
      })
    );

    this.expandedSteps$ = combineLatest([this.selectedCourseId$, this.expandedUserId$, this.training.courses$, this.training.progress$]).pipe(
      map(([courseId, userId, _courses, progress]) => {
        if (!courseId || !userId) return [];
        const course = this.training.getCourseById(courseId);
        if (!course) return [];
        const p = (progress || []).find(row => row.courseId === courseId && row.userId === userId) || null;
        const completed = new Set((p?.completedLessonIds || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0));
        const byLesson = (p?.timeSpentMsByLessonId || {}) as Record<number, number>;

        const mods = [...(course.modules || [])].sort((a, b) => a.order - b.order);
        const out: StepRow[] = [];
        for (const m of mods) {
          const lessons = [...(m.lessons || [])].sort((a, b) => a.order - b.order);
          for (const l of lessons) {
            const lid = Number(l.id);
            out.push({
              moduleTitle: m.title,
              lessonId: lid,
              lessonTitle: l.title,
              type: l.type,
              completed: completed.has(lid),
              timeSpentMs: Math.max(0, Number(byLesson[lid] || 0))
            });
          }
        }
        return out;
      })
    );
  }

  ngOnInit(): void {
    this.loadAgents();
  }

  onCourseChange(): void {
    const id = this.selectedCourseId ? Number(this.selectedCourseId) : null;
    this.selectedCourseId$.next(id && id > 0 ? id : null);
    this.expandedUserId = null;
    this.expandedUserId$.next(null);
  }

  toggleDetails(userId: number): void {
    const uid = Number(userId || 0);
    if (!uid) return;
    const next = this.expandedUserId === uid ? null : uid;
    this.expandedUserId = next;
    this.expandedUserId$.next(next);
  }

  exportCsv(rows: AnalyticsRow[], course: TrainingCourse | null): void {
    const header = [
      'course_id',
      'course_title',
      'user_id',
      'name',
      'email',
      'mandatory',
      'due_at',
      'state',
      'progress_percent',
      'time_spent_ms',
      'last_seen_at',
      'completed_at'
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        course?.id ?? '',
        csv(course?.title ?? ''),
        r.userId,
        csv(r.name),
        csv(r.email),
        r.mandatory ? 'true' : 'false',
        r.dueAt ?? '',
        r.state,
        r.progressPercent,
        r.timeSpentMs,
        r.lastSeenAt ?? '',
        r.completedAt ?? ''
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academy-analytics-course-${course?.id ?? 'all'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  exportStepsCsv(rows: AnalyticsRow[], course: TrainingCourse | null): void {
    if (!course?.id) return;
    const header = [
      'course_id',
      'course_title',
      'user_id',
      'name',
      'email',
      'lesson_id',
      'lesson_title',
      'module_title',
      'lesson_type',
      'completed',
      'time_spent_ms'
    ];

    const mods = [...(course.modules || [])].sort((a, b) => a.order - b.order);
    const lessons: { lessonId: number; lessonTitle: string; moduleTitle: string; type: TrainingLessonType }[] = [];
    for (const m of mods) {
      const ls = [...(m.lessons || [])].sort((a, b) => a.order - b.order);
      for (const l of ls) {
        lessons.push({ lessonId: Number(l.id), lessonTitle: l.title, moduleTitle: m.title, type: l.type });
      }
    }

    const lines = [header.join(',')];
    for (const r of rows) {
      const p = this.training.progress.find(pp => pp.courseId === course.id && pp.userId === r.userId) || null;
      const completed = new Set((p?.completedLessonIds || []).map(v => Number(v)));
      const byLesson = (p?.timeSpentMsByLessonId || {}) as Record<number, number>;
      for (const l of lessons) {
        const ms = Math.max(0, Number(byLesson[l.lessonId] || 0));
        lines.push([
          course.id,
          csv(course.title),
          r.userId,
          csv(r.name),
          csv(r.email),
          l.lessonId,
          csv(l.lessonTitle),
          csv(l.moduleTitle),
          l.type,
          completed.has(l.lessonId) ? 'true' : 'false',
          ms
        ].join(','));
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academy-analytics-steps-course-${course.id}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  getCourseById(courseId: number | null): TrainingCourse | null {
    if (!courseId) return null;
    return this.training.getCourseById(courseId);
  }

  formatDuration(ms: number): string {
    const total = Math.max(0, Math.round(Number(ms || 0)));
    const sec = Math.floor(total / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  private rowsForAssignments(assignments: TrainingAssignment[]): AnalyticsRow[] {
    const courseId = this.selectedCourseId$.value;
    if (!courseId) return [];
    const course = this.training.getCourseById(courseId);
    if (!course) return [];

    const totalLessons = this.training.countTotalLessons(course);

    const result: AnalyticsRow[] = [];
    for (const a of assignments) {
      const uid = Number(a.userId);
      if (!uid) continue;
      const summary = this.training.getCourseSummaryForUser(uid, courseId);
      const p = summary?.progress ?? null;
      const completedLessons = p?.completedLessonIds?.length || 0;
      const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const timeSpentMs = Object.values((p?.timeSpentMsByLessonId || {}) as Record<number, number>).reduce((sum, v) => sum + Math.max(0, Number(v || 0)), 0);
      const agent = this.agentById.get(uid);
      const name = agent ? `${agent.firstName} ${agent.lastName}`.trim() : `Agent #${uid}`;
      const email = agent?.email || '';
      result.push({
        userId: uid,
        name,
        email,
        mandatory: !!a.mandatory,
        dueAt: a.dueAt || null,
        state: (p?.state || 'NOT_STARTED') as TrainingProgressState,
        progressPercent,
        lastSeenAt: p?.lastSeenAt || null,
        completedAt: p?.completedAt || null,
        timeSpentMs
      });
    }

    const stateRank: Record<TrainingProgressState, number> = { IN_PROGRESS: 0, NOT_STARTED: 1, COMPLETED: 2 };
    return result.sort((x, y) => {
      if (stateRank[x.state] !== stateRank[y.state]) return stateRank[x.state] - stateRank[y.state];
      const dx = x.dueAt ? new Date(x.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const dy = y.dueAt ? new Date(y.dueAt).getTime() : Number.POSITIVE_INFINITY;
      if (dx !== dy) return dx - dy;
      return x.name.localeCompare(y.name);
    });
  }

  private loadAgents(): void {
    this.agentsLoading = true;
    this.agentsError = '';
    this.agentsNotice = '';
    const role = this.auth.getNormalizedRole();
    const meId = Number(this.auth.getUser()?.id || 0);
    const scopeRole: TeamManagerRole | null = role === 'QA' ? 'QA' : (role === 'TEAM_LEADER' ? 'TEAM_LEADER' : null);

    const users$ = this.staff.listUsers().pipe(
      catchError((err) => {
        const status = Number(err?.status || 0);
        // In some environments /api/staff is restricted to admins only; analytics can still work without names.
        if (status === 401 || status === 403) {
          this.agentsNotice = 'Staff directory access is restricted for your account. Showing agent IDs only.';
          this.agentsError = '';
          return of([] as StaffUser[]);
        }
        this.agentsError = err?.error?.message || 'Could not load agents.';
        return of([] as StaffUser[]);
      })
    );
    const scopeIds$ = scopeRole && meId > 0
      ? this.teamLinks.getAgentIdsForManager(scopeRole, meId).pipe(catchError(() => of([] as number[])))
      : of([] as number[]);

    forkJoin({ users: users$, ids: scopeIds$ })
      .pipe(finalize(() => (this.agentsLoading = false)))
      .subscribe(({ users, ids }) => {
        const allAgents = (users || [])
          .filter(u => u.active)
          .filter(u => this.normalizeRole(u.role) === 'AGENT');

        if (scopeRole) {
          const allowed = new Set((ids || []).map((v: number) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0));
          this.scopeIds$.next(allowed);
          this.agents = allAgents.filter(a => allowed.has(Number(a.id)));
          this.agentById = new Map(this.agents.map(a => [a.id, a]));
          if (this.agents.length === 0) {
            this.agentsError = this.agentsError || 'No agents are linked to your account in Team Management.';
          }
          return;
        }

        this.scopeIds$.next(null);
        this.agents = allAgents;
        this.agentById = new Map(allAgents.map(a => [a.id, a]));
      });
  }

  private normalizeRole(raw: string): string {
    const role = (raw || '').toUpperCase().replace('ROLE_', '');
    if (role === '2') return 'AGENT';
    if (role === '1') return 'ADMIN';
    if (role === 'HEAD_OF_CS') return 'HEAD_CS';
    if (role === 'OPS') return 'HEAD_CS';
    return role;
  }
}

function csv(v: string): string {
  const raw = (v ?? '').toString();
  if (!raw.includes(',') && !raw.includes('"') && !raw.includes('\n')) return raw;
  return `"${raw.replace(/\"/g, '""')}"`;
}
