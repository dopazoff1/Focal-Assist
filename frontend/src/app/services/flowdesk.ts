import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { ServerStateService } from './server-state';

export type FlowDeskIssueType = 'story' | 'task' | 'bug';
export type FlowDeskPriority = 'low' | 'medium' | 'high' | 'critical';
export type FlowDeskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type FlowDeskSprintState = 'planned' | 'active' | 'closed';

export interface FlowDeskIssue {
  id: number;
  key: string;
  title: string;
  description: string;
  type: FlowDeskIssueType;
  priority: FlowDeskPriority;
  status: FlowDeskStatus;
  points: number;
  assignee: string;
  reporter: string;
  sprintId: number | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FlowDeskSprint {
  id: number;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  state: FlowDeskSprintState;
}

interface FlowDeskState {
  issues: FlowDeskIssue[];
  sprints: FlowDeskSprint[];
  nextIssueId: number;
  nextSprintId: number;
}

@Injectable({
  providedIn: 'root'
})
export class FlowDeskService {
  private readonly storageKey = 'flowdesk-state-v1';
  private readonly state$ = new BehaviorSubject<FlowDeskState>(this.seedState());
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistInFlight = false;
  private pendingPersist = false;

  readonly issues$ = this.state$.asObservable().pipe(map(state => state.issues));
  readonly sprints$ = this.state$.asObservable().pipe(map(state => state.sprints));
  constructor(private serverState: ServerStateService) {
    if (typeof window === 'undefined') return;
    this.serverState.loadState<FlowDeskState>(this.storageKey).subscribe({
      next: (remote) => {
        if (remote) {
          this.state$.next(this.normalizeState(remote));
          return;
        }
        this.schedulePersist();
      },
      error: () => {
        // Keep seeded state in memory if server load fails.
      }
    });
  }

  get issues(): FlowDeskIssue[] {
    return this.state$.value.issues;
  }

  get sprints(): FlowDeskSprint[] {
    return this.state$.value.sprints;
  }

  createIssue(input: {
    title: string;
    description?: string;
    type: FlowDeskIssueType;
    priority: FlowDeskPriority;
    points?: number;
    assignee?: string;
    reporter?: string;
    labels?: string[];
    sprintId?: number | null;
  }): FlowDeskIssue {
    const state = this.state$.value;
    const id = state.nextIssueId;
    const now = new Date().toISOString();
    const key = `FD-${id}`;

    const issue: FlowDeskIssue = {
      id,
      key,
      title: (input.title || '').trim(),
      description: (input.description || '').trim(),
      type: input.type,
      priority: input.priority,
      status: 'todo',
      points: Math.max(0, Number(input.points || 0)),
      assignee: (input.assignee || 'Unassigned').trim() || 'Unassigned',
      reporter: (input.reporter || 'System').trim() || 'System',
      sprintId: input.sprintId ?? null,
      labels: Array.isArray(input.labels) ? input.labels.filter(Boolean) : [],
      createdAt: now,
      updatedAt: now
    };

    this.commit({
      ...state,
      issues: [issue, ...state.issues],
      nextIssueId: id + 1
    });

    return issue;
  }

  moveIssue(issueId: number, status: FlowDeskStatus): void {
    this.updateIssue(issueId, { status });
  }

  updateIssue(issueId: number, patch: Partial<Omit<FlowDeskIssue, 'id' | 'key' | 'createdAt'>>): void {
    const state = this.state$.value;
    const issues = state.issues.map(issue => {
      if (issue.id !== issueId) return issue;
      return {
        ...issue,
        ...patch,
        updatedAt: new Date().toISOString()
      };
    });
    this.commit({ ...state, issues });
  }

  assignIssueToSprint(issueId: number, sprintId: number | null): void {
    this.updateIssue(issueId, { sprintId });
  }

  createSprint(input: { name: string; goal?: string; startDate: string; endDate: string }): FlowDeskSprint {
    const state = this.state$.value;
    const sprint: FlowDeskSprint = {
      id: state.nextSprintId,
      name: (input.name || '').trim(),
      goal: (input.goal || '').trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      state: 'planned'
    };

    this.commit({
      ...state,
      sprints: [sprint, ...state.sprints],
      nextSprintId: state.nextSprintId + 1
    });

    return sprint;
  }

  setSprintState(sprintId: number, nextState: FlowDeskSprintState): void {
    const state = this.state$.value;
    const sprints = state.sprints.map(s => (s.id === sprintId ? { ...s, state: nextState } : s));
    this.commit({ ...state, sprints });
  }

  getActiveSprint(): FlowDeskSprint | null {
    return this.sprints.find(s => s.state === 'active') ?? null;
  }

  getIssuesForSprint(sprintId: number): FlowDeskIssue[] {
    return this.issues.filter(issue => issue.sprintId === sprintId);
  }

    private commit(state: FlowDeskState): void {
    this.state$.next(this.normalizeState(state));
    this.schedulePersist();
  }

  private normalizeState(raw: Partial<FlowDeskState> | null | undefined): FlowDeskState {
    const parsed = raw as FlowDeskState | null | undefined;
    if (!parsed || !Array.isArray(parsed.issues) || !Array.isArray(parsed.sprints)) {
      return this.seedState();
    }
    const maxIssueId = parsed.issues.reduce((max, issue) => Math.max(max, Number(issue?.id || 0)), 0);
    const maxSprintId = parsed.sprints.reduce((max, sprint) => Math.max(max, Number(sprint?.id || 0)), 0);
    return {
      issues: parsed.issues,
      sprints: parsed.sprints,
      nextIssueId: Math.max(Number(parsed.nextIssueId || 0), maxIssueId + 1),
      nextSprintId: Math.max(Number(parsed.nextSprintId || 0), maxSprintId + 1)
    };
  }

  private schedulePersist(): void {
    if (typeof window === 'undefined') return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistState();
    }, 120);
  }

  private persistState(): void {
    if (this.persistInFlight) {
      this.pendingPersist = true;
      return;
    }
    this.persistInFlight = true;
    const snapshot = this.normalizeState(this.state$.value);
    this.serverState.saveState(this.storageKey, snapshot).subscribe({
      next: () => {},
      error: () => {},
      complete: () => {
        this.persistInFlight = false;
        if (this.pendingPersist) {
          this.pendingPersist = false;
          this.schedulePersist();
        }
      }
    });
  }
  private seedState(): FlowDeskState {
    const now = new Date().toISOString();
    return {
      nextIssueId: 6,
      nextSprintId: 3,
      sprints: [
        {
          id: 2,
          name: 'Sprint 2',
          goal: 'Reduce first response time under 10 minutes',
          startDate: '2026-02-10',
          endDate: '2026-02-24',
          state: 'active'
        },
        {
          id: 1,
          name: 'Sprint 1',
          goal: 'Stabilize CRM ticket workflow',
          startDate: '2026-01-20',
          endDate: '2026-02-05',
          state: 'closed'
        }
      ],
      issues: [
        {
          id: 5,
          key: 'FD-5',
          title: 'Add SLA badge on ticket cards',
          description: 'Display SLA warning in My Cases and Open Cases.',
          type: 'story',
          priority: 'high',
          status: 'in_progress',
          points: 5,
          assignee: 'Nadia QA',
          reporter: 'OPS',
          sprintId: 2,
          labels: ['crm', 'sla'],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 4,
          key: 'FD-4',
          title: 'Persist internal notes in thread view',
          description: 'Internal notes should survive refresh and show in timeline.',
          type: 'bug',
          priority: 'critical',
          status: 'in_review',
          points: 3,
          assignee: 'Yassine TL',
          reporter: 'QA',
          sprintId: 2,
          labels: ['crm', 'notes'],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 3,
          key: 'FD-3',
          title: 'Improve ticket composer spacing',
          description: 'Keep composer sticky at bottom while scrolling thread.',
          type: 'task',
          priority: 'medium',
          status: 'todo',
          points: 2,
          assignee: 'Unassigned',
          reporter: 'Admin',
          sprintId: null,
          labels: ['ui'],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 2,
          key: 'FD-2',
          title: 'Team visibility matrix for QA and TL',
          description: 'QA sees only linked agents, TL sees own team.',
          type: 'story',
          priority: 'high',
          status: 'done',
          points: 8,
          assignee: 'OPS',
          reporter: 'Head CS',
          sprintId: 1,
          labels: ['roles', 'permissions'],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 1,
          key: 'FD-1',
          title: 'Create case tag builder hierarchy',
          description: 'Categories -> subcategories -> subdivisions -> choice.',
          type: 'story',
          priority: 'high',
          status: 'done',
          points: 8,
          assignee: 'Admin',
          reporter: 'Admin',
          sprintId: 1,
          labels: ['tags'],
          createdAt: now,
          updatedAt: now
        }
      ]
    };
  }
}

