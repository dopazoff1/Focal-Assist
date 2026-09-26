import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { FlowDeskIssue, FlowDeskPriority, FlowDeskService, FlowDeskStatus, FlowDeskIssueType } from '../../services/flowdesk';

interface BoardColumn {
  status: FlowDeskStatus;
  title: string;
}

@Component({
  selector: 'app-flowdesk-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flowdesk-board.html',
  styleUrl: './flowdesk-board.css'
})
export class FlowdeskBoard {
  readonly issues$: Observable<FlowDeskIssue[]>;

  readonly columns: BoardColumn[] = [
    { status: 'todo', title: 'To Do' },
    { status: 'in_progress', title: 'In Progress' },
    { status: 'in_review', title: 'In Review' },
    { status: 'done', title: 'Done' }
  ];

  createTitle = '';
  createAssignee = '';
  createType: FlowDeskIssueType = 'task';
  createPriority: FlowDeskPriority = 'medium';
  createPoints = 1;

  constructor(private flowDesk: FlowDeskService) {
    this.issues$ = this.flowDesk.issues$;
  }

  countByStatus(issues: FlowDeskIssue[], status: FlowDeskStatus): number {
    return issues.filter(issue => issue.status === status).length;
  }

  inColumn(issues: FlowDeskIssue[], status: FlowDeskStatus): FlowDeskIssue[] {
    return issues.filter(issue => issue.status === status);
  }

  move(issueId: number, status: FlowDeskStatus): void {
    this.flowDesk.moveIssue(issueId, status);
  }

  createQuickIssue(): void {
    if (!this.createTitle.trim()) return;
    this.flowDesk.createIssue({
      title: this.createTitle,
      assignee: this.createAssignee,
      type: this.createType,
      priority: this.createPriority,
      points: this.createPoints,
      reporter: 'FlowDesk Board'
    });
    this.createTitle = '';
    this.createAssignee = '';
    this.createType = 'task';
    this.createPriority = 'medium';
    this.createPoints = 1;
  }

  nextStatus(current: FlowDeskStatus): FlowDeskStatus | null {
    if (current === 'todo') return 'in_progress';
    if (current === 'in_progress') return 'in_review';
    if (current === 'in_review') return 'done';
    return null;
  }

  prevStatus(current: FlowDeskStatus): FlowDeskStatus | null {
    if (current === 'done') return 'in_review';
    if (current === 'in_review') return 'in_progress';
    if (current === 'in_progress') return 'todo';
    return null;
  }
}
