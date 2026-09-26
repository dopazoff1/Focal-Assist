import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { FlowDeskIssue, FlowDeskService } from '../../services/flowdesk';

@Component({
  selector: 'app-flowdesk-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flowdesk-reports.html',
  styleUrl: './flowdesk-reports.css'
})
export class FlowdeskReports {
  readonly issues$: Observable<FlowDeskIssue[]>;

  constructor(private flowDesk: FlowDeskService) {
    this.issues$ = this.flowDesk.issues$;
  }

  statusCount(issues: FlowDeskIssue[], status: string): number {
    return issues.filter(issue => issue.status === status).length;
  }

  priorityCount(issues: FlowDeskIssue[], priority: string): number {
    return issues.filter(issue => issue.priority === priority).length;
  }

  percent(value: number, total: number): number {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  assigneeLoad(issues: FlowDeskIssue[]): Array<{ assignee: string; count: number }> {
    const bucket = new Map<string, number>();
    for (const issue of issues) {
      const key = issue.assignee || 'Unassigned';
      bucket.set(key, (bucket.get(key) || 0) + 1);
    }
    return [...bucket.entries()]
      .map(([assignee, count]) => ({ assignee, count }))
      .sort((a, b) => b.count - a.count);
  }
}
