import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, finalize, forkJoin, map, Observable, of } from 'rxjs';
import { AuthService } from '../../services/auth';
import { StaffService, StaffUser } from '../../services/staff';
import { TeamLinksService, TeamManagerRole } from '../../services/team-links';
import { TrainingAssignment, TrainingCourse, TrainingCourseStatus, TrainingService } from '../../services/training';

type StatusFilter = TrainingCourseStatus | 'ALL';

@Component({
  selector: 'app-training-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './training-studio.html',
  styleUrls: ['./training-studio.css']
})
export class TrainingStudio implements OnInit {
  search = '';
  status: StatusFilter = 'ALL';
  private readonly refresh$ = new BehaviorSubject<number>(0);

  agentSearch = '';
  dueAt = '';
  mandatory = true;

  selectedCourseId: number | null = null;
  selectedAgentIds = new Set<number>();

  agents: StaffUser[] = [];
  agentsLoading = false;
  agentsError = '';
  agentsNotice = '';

  readonly courses$: Observable<TrainingCourse[]>;
  readonly assignments$: Observable<TrainingAssignment[]>;

  constructor(
    public auth: AuthService,
    private training: TrainingService,
    private staff: StaffService,
    private teamLinks: TeamLinksService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.courses$ = combineLatest([this.training.courses$, this.refresh$]).pipe(
      map(() => this.filterCourses())
    );
    this.assignments$ = this.training.assignments$;
  }

  ngOnInit(): void {
    this.loadAgents();
  }

  get meId(): number {
    return Number(this.auth.getUser()?.id || 0);
  }

  createCourse(): void {
    const created = this.training.createCourse(this.meId);
    void this.router.navigate(['./course', created.id], { relativeTo: this.route });
  }

  bump(): void {
    this.refresh$.next(this.refresh$.value + 1);
  }

  openCourse(courseId: number): void {
    void this.router.navigate(['./course', courseId], { relativeTo: this.route });
  }

  publish(courseId: number): void {
    this.training.publishCourse(courseId);
  }

  unpublish(courseId: number): void {
    this.training.unpublishCourse(courseId);
  }

  archive(courseId: number): void {
    this.training.archiveCourse(courseId);
  }

  duplicate(courseId: number): void {
    const copy = this.training.duplicateCourse(courseId, this.meId);
    if (copy) {
      this.selectedCourseId = copy.id;
    }
  }

  delete(courseId: number): void {
    this.training.deleteCourse(courseId);
    if (this.selectedCourseId === courseId) {
      this.selectedCourseId = null;
      this.selectedAgentIds.clear();
    }
  }

  toggleAgent(agentId: number): void {
    if (this.selectedAgentIds.has(agentId)) this.selectedAgentIds.delete(agentId);
    else this.selectedAgentIds.add(agentId);
  }

  selectAllAgents(): void {
    this.filteredAgents().forEach(a => this.selectedAgentIds.add(a.id));
  }

  clearAgents(): void {
    this.selectedAgentIds.clear();
  }

  assignSelected(): void {
    if (!this.selectedCourseId) return;
    const ids = Array.from(this.selectedAgentIds.values());
    const dueIso = this.dueAt ? new Date(`${this.dueAt}T23:59:59`).toISOString() : null;
    this.training.assignCourse(this.selectedCourseId, ids, this.meId, dueIso, this.mandatory);
  }

  unassign(courseId: number, userId: number): void {
    this.training.unassignCourse(courseId, userId);
  }

  assignmentsForSelected(all: TrainingAssignment[]): TrainingAssignment[] {
    if (!this.selectedCourseId) return [];
    return (all || []).filter(a => a.courseId === this.selectedCourseId);
  }

  filteredAgents(): StaffUser[] {
    const q = (this.agentSearch || '').trim().toLowerCase();
    let rows = this.agents;
    if (q) {
      rows = rows.filter(a => `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(q));
    }
    return rows;
  }

  nameOf(userId: number): string {
    const hit = this.agents.find(a => a.id === userId);
    if (!hit) return `Agent #${userId}`;
    const name = `${hit.firstName} ${hit.lastName}`.trim();
    return hit.email ? `${name} (${hit.email})` : name;
  }

  private loadAgents(): void {
    this.agentsLoading = true;
    this.agentsError = '';
    this.agentsNotice = '';
    const role = this.auth.getNormalizedRole();
    const meId = this.meId;
    const scopeRole: TeamManagerRole | null = role === 'QA' ? 'QA' : (role === 'TEAM_LEADER' ? 'TEAM_LEADER' : null);

    const users$ = this.staff.listUsers().pipe(
      catchError((err) => {
        const status = Number(err?.status || 0);
        if (status === 401 || status === 403) {
          this.agentsNotice = 'Staff directory access is restricted for your account. Showing IDs only in assignments.';
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
          .filter(u => this.normalizeRole(u.role) === 'AGENT')
          .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

        if (scopeRole) {
          const allowed = new Set((ids || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0));
          this.agents = allAgents.filter(a => allowed.has(Number(a.id)));
          if (this.agents.length === 0) {
            this.agentsError = this.agentsError || 'No agents are linked to your account in Team Management.';
          }
          return;
        }

        this.agents = allAgents;
      });
  }

  private filterCourses(): TrainingCourse[] {
    const q = (this.search || '').trim().toLowerCase();
    let rows = this.training.listCoursesForStudio();
    if (this.status !== 'ALL') rows = rows.filter(c => c.status === this.status);
    if (q) {
      rows = rows.filter(c => {
        const hay = `${c.title} ${c.subtitle} ${c.description} ${(c.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
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
