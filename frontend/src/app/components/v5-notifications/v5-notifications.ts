import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface Notice {
  id: number;
  title: string;
  body: string;
  time: string;
  level: 'info' | 'success' | 'warning' | 'critical';
  read: boolean;
}

@Component({
  selector: 'app-v5-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './v5-notifications.html',
  styleUrls: ['../v5-shared/v5-page.css', './v5-notifications.css']
})
export class V5NotificationsComponent {
  filter: 'all' | 'unread' | 'critical' = 'all';

  notices: Notice[] = [
    { id: 1, title: 'SLA breach risk on Ticket #4208', body: 'No response from L2 in 2h. Escalate or reassign.', time: '2 min ago', level: 'critical', read: false },
    { id: 2, title: 'Deal moved to negotiation', body: 'Forte Capital accepted revised scope and requested timeline.', time: '11 min ago', level: 'success', read: false },
    { id: 3, title: 'Weekly KPI report ready', body: 'Performance snapshot is available for export.', time: '35 min ago', level: 'info', read: true },
    { id: 4, title: 'Missing data in onboarding form', body: '4 new leads were submitted without required company size.', time: '1h ago', level: 'warning', read: false }
  ];

  get unreadCount(): number {
    return this.notices.filter(n => !n.read).length;
  }

  get filtered(): Notice[] {
    if (this.filter === 'unread') return this.notices.filter(n => !n.read);
    if (this.filter === 'critical') return this.notices.filter(n => n.level === 'critical' || n.level === 'warning');
    return this.notices;
  }

  setFilter(next: 'all' | 'unread' | 'critical'): void {
    this.filter = next;
  }

  markRead(item: Notice): void {
    item.read = true;
  }

  markAllRead(): void {
    this.notices = this.notices.map(n => ({ ...n, read: true }));
  }
}


