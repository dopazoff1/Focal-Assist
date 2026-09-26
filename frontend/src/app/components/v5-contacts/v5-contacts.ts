import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ContactItem {
  id: number;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  segment: string;
  health: 'Healthy' | 'Watch' | 'Risk';
  arr: string;
  openDeals: number;
  notes: string;
  timeline: Array<{ date: string; text: string }>;
}

@Component({
  selector: 'app-v5-contacts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './v5-contacts.html',
  styleUrls: ['../v5-shared/v5-page.css', './v5-contacts.css']
})
export class V5ContactsComponent {
  search = '';
  selectedId = 1;

  readonly contacts: ContactItem[] = [
    {
      id: 1,
      name: 'Yuriy Oliynyk',
      title: 'Head of Operations',
      company: 'Fintech Farm',
      email: 'yuriy@fintech-farm.com',
      phone: '+44 20 3100 4401',
      segment: 'Enterprise',
      health: 'Healthy',
      arr: '$120k',
      openDeals: 2,
      notes: 'Prefers weekly progress snapshots and clear SLA commitments.',
      timeline: [
        { date: 'Today', text: 'Requested onboarding timeline for new agents.' },
        { date: 'Yesterday', text: 'Approved pilot scope for QA and adherence modules.' },
        { date: 'Mar 29', text: 'Shared list of top escalation pain points.' }
      ]
    },
    {
      id: 2,
      name: 'Lina Serrano',
      title: 'Customer Success Lead',
      company: 'Nexora',
      email: 'lina@nexora.io',
      phone: '+33 6 20 88 91 42',
      segment: 'Growth',
      health: 'Watch',
      arr: '$64k',
      openDeals: 1,
      notes: 'Needs stronger reporting exports before full rollout.',
      timeline: [
        { date: 'Today', text: 'Asked for KPI template for monthly review.' },
        { date: 'Mar 30', text: 'Raised concern about duplicate ticket handling.' }
      ]
    },
    {
      id: 3,
      name: 'Marcus Reed',
      title: 'Support Manager',
      company: 'BlueField',
      email: 'marcus@bluefield.ai',
      phone: '+1 415 990 2231',
      segment: 'Mid-market',
      health: 'Risk',
      arr: '$28k',
      openDeals: 3,
      notes: 'Blocked by slow handoff from L1 to L2; wants escalation board training.',
      timeline: [
        { date: 'Today', text: 'Escalated unresolved ticket aging issue.' },
        { date: 'Mar 28', text: 'Missed onboarding checkpoint.' }
      ]
    }
  ];

  get filteredContacts(): ContactItem[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.contacts;
    return this.contacts.filter(c => {
      const stack = `${c.name} ${c.company} ${c.email} ${c.segment}`.toLowerCase();
      return stack.includes(q);
    });
  }

  get selectedContact(): ContactItem | null {
    return this.contacts.find(c => c.id === this.selectedId) || this.filteredContacts[0] || null;
  }

  selectContact(id: number): void {
    this.selectedId = id;
  }
}


