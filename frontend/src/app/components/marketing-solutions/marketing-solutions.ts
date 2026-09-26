import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

type PersonaCard = {
  role: string;
  goal: string;
  outcomes: string[];
};

type IndustryCard = {
  title: string;
  summary: string;
  points: string[];
};

@Component({
  selector: 'app-marketing-solutions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marketing-solutions.html',
  styleUrls: ['./marketing-solutions.css']
})
export class MarketingSolutions {
  readonly personas: PersonaCard[] = [
    {
      role: 'Agent',
      goal: 'Resolve cases faster with less guesswork.',
      outcomes: ['Guided SOP responses from Magic Assistance', 'One workspace for replies, notes, and tags', 'Knowledge suggestions in context']
    },
    {
      role: 'Team Leader',
      goal: 'Manage team throughput and service quality.',
      outcomes: ['Team-level adherence visibility', 'Queue and SLA monitoring', 'Ticket oversight without noisy tooling']
    },
    {
      role: 'QA',
      goal: 'Evaluate accurately and coach effectively.',
      outcomes: ['Structured QA forms by ticket', 'Evaluation history per agent', 'Find recurring gaps and training needs']
    },
    {
      role: 'Head Of Operations',
      goal: 'Scale support with control and predictability.',
      outcomes: ['Cross-team KPI tracking', 'Governance over workflows and permissions', 'Operational planning through FlowDesk']
    }
  ];

  readonly industries: IndustryCard[] = [
    {
      title: 'Fintech Support Operations',
      summary: 'Run high-volume, regulated support with process discipline and full traceability.',
      points: ['KYC, loan, and payment issue playbooks', 'SLA-focused case routing', 'Audit-ready timeline and role controls']
    },
    {
      title: 'BPO / Outsourced Teams',
      summary: 'Standardize handling quality across multiple clients and campaigns.',
      points: ['Client-specific SOP trees', 'Team segmentation and visibility rules', 'QA and adherence by account']
    },
    {
      title: 'Multi-Market Support',
      summary: 'Coordinate distributed teams with consistent outcomes across geographies.',
      points: ['Timezone-aware staffing', 'Unified taxonomy and training academy', 'Central control with local execution']
    }
  ];
}

