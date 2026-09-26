import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface KpiCard {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down';
}

interface ActivityItem {
  title: string;
  detail: string;
  time: string;
  type: 'deal' | 'task' | 'risk' | 'win';
}

@Component({
  selector: 'app-v4-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './v4-dashboard.html',
  styleUrls: ['../v4-shared/v4-page.css', './v4-dashboard.css']
})
export class V4DashboardComponent {
  readonly kpis: KpiCard[] = [
    { label: 'Pipeline Value', value: '$1.84M', delta: '+12.4% vs last month', trend: 'up' },
    { label: 'Win Rate', value: '31.6%', delta: '+3.1 pts', trend: 'up' },
    { label: 'Avg. Sales Cycle', value: '18 days', delta: '-2 days', trend: 'up' },
    { label: 'At-Risk Deals', value: '14', delta: '+2 this week', trend: 'down' }
  ];

  readonly revenueBars = [48, 52, 56, 60, 58, 66, 74, 70, 78, 82, 88, 94];

  readonly activities: ActivityItem[] = [
    {
      title: 'Follow-up sent to Fintech Farm',
      detail: 'Enterprise renewal moved to final negotiation.',
      time: '4 min ago',
      type: 'deal'
    },
    {
      title: 'SLA risk flagged on Ticket #4021',
      detail: 'No update for 18h. Escalation recommended.',
      time: '16 min ago',
      type: 'risk'
    },
    {
      title: 'Task completed: Q2 onboarding sequence',
      detail: 'Playbook updated and approved by Ops.',
      time: '42 min ago',
      type: 'task'
    },
    {
      title: 'Deal won: Nexora Systems',
      detail: 'Closed at $84k ARR with annual billing.',
      time: '1h ago',
      type: 'win'
    }
  ];

  readonly nextBestActions = [
    'Call 6 high-intent leads in proposal stage',
    'Review 3 deals with no activity in 5+ days',
    'Push timeline update to onboarding stakeholders',
    'Send renewal risk report to Team Lead'
  ];
}
