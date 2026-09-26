import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { FlowDeskIssue, FlowDeskIssueType, FlowDeskPriority, FlowDeskService } from '../../services/flowdesk';

@Component({
  selector: 'app-flowdesk-backlog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flowdesk-backlog.html',
  styleUrl: './flowdesk-backlog.css'
})
export class FlowdeskBacklog {
  readonly issues$: Observable<FlowDeskIssue[]>;

  newTitle = '';
  newDescription = '';
  newAssignee = '';
  newType: FlowDeskIssueType = 'story';
  newPriority: FlowDeskPriority = 'medium';
  newPoints = 3;
  query = '';

  constructor(private flowDesk: FlowDeskService) {
    this.issues$ = this.flowDesk.issues$;
  }

  createIssue(): void {
    if (!this.newTitle.trim()) return;
    this.flowDesk.createIssue({
      title: this.newTitle,
      description: this.newDescription,
      assignee: this.newAssignee,
      type: this.newType,
      priority: this.newPriority,
      points: this.newPoints,
      reporter: 'Backlog'
    });
    this.newTitle = '';
    this.newDescription = '';
    this.newAssignee = '';
    this.newType = 'story';
    this.newPriority = 'medium';
    this.newPoints = 3;
  }

  filtered(issues: FlowDeskIssue[]): FlowDeskIssue[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter(issue =>
      issue.key.toLowerCase().includes(q)
      || issue.title.toLowerCase().includes(q)
      || issue.assignee.toLowerCase().includes(q)
      || issue.priority.toLowerCase().includes(q)
    );
  }
}
