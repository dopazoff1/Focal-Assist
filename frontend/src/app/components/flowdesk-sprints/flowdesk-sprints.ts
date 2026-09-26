import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { FlowDeskIssue, FlowDeskService, FlowDeskSprint } from '../../services/flowdesk';

@Component({
  selector: 'app-flowdesk-sprints',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flowdesk-sprints.html',
  styleUrl: './flowdesk-sprints.css'
})
export class FlowdeskSprints {
  readonly sprints$: Observable<FlowDeskSprint[]>;
  readonly issues$: Observable<FlowDeskIssue[]>;

  sprintName = '';
  sprintGoal = '';
  sprintStart = '';
  sprintEnd = '';

  constructor(private flowDesk: FlowDeskService) {
    this.sprints$ = this.flowDesk.sprints$;
    this.issues$ = this.flowDesk.issues$;
  }

  createSprint(): void {
    if (!this.sprintName.trim() || !this.sprintStart || !this.sprintEnd) return;
    this.flowDesk.createSprint({
      name: this.sprintName,
      goal: this.sprintGoal,
      startDate: this.sprintStart,
      endDate: this.sprintEnd
    });
    this.sprintName = '';
    this.sprintGoal = '';
    this.sprintStart = '';
    this.sprintEnd = '';
  }

  setState(sprintId: number, next: 'planned' | 'active' | 'closed'): void {
    this.flowDesk.setSprintState(sprintId, next);
  }

  issuesFor(issues: FlowDeskIssue[], sprintId: number): FlowDeskIssue[] {
    return issues.filter(issue => issue.sprintId === sprintId);
  }

  progress(issues: FlowDeskIssue[], sprintId: number): number {
    const sprintIssues = this.issuesFor(issues, sprintId);
    if (!sprintIssues.length) return 0;
    const done = sprintIssues.filter(issue => issue.status === 'done').length;
    return Math.round((done / sprintIssues.length) * 100);
  }

  assign(issueId: number, sprintId: number | null): void {
    this.flowDesk.assignIssueToSprint(issueId, sprintId);
  }
}
