import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type ModuleCard = {
  name: string;
  code: string;
  summary: string;
  bullets: string[];
};

@Component({
  selector: 'app-marketing-platform',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './marketing-platform.html',
  styleUrls: ['./marketing-platform.css']
})
export class MarketingPlatform {
  readonly modules: ModuleCard[] = [
    {
      name: 'CRM Inbox',
      code: 'IN',
      summary: 'Omnichannel handling across email, chat, and social with assignment, SLA, and audit trail.',
      bullets: ['Unified timeline for every customer touchpoint', 'Smart assignment and ownership controls', 'Internal notes, tags, and escalation routing']
    },
    {
      name: 'Magic Assistance',
      code: 'MA',
      summary: 'Decision trees that guide agents to the right answer in seconds with process discipline.',
      bullets: ['Visual tree builder for operations teams', 'Consistent handling for recurring issues', 'Reduced handling time and lower knowledge variance']
    },
    {
      name: 'Knowledge Base + SOP',
      code: 'KB',
      summary: 'Structured articles linked to process maps for fast discovery and execution.',
      bullets: ['Article management with map view', 'Clickable steps with contextual details', 'Search-first access for frontline teams']
    },
    {
      name: 'Quality + Adherence',
      code: 'QA',
      summary: 'Performance governance across evaluations, attendance timeline, and compliance metrics.',
      bullets: ['QA forms by ticket and agent', 'Adherence timeline by role and team', 'Data for coaching, calibration, and accountability']
    },
    {
      name: 'Training Academy',
      code: 'AC',
      summary: 'Operational learning platform with courses, assessments, and completion analytics.',
      bullets: ['Course studio with role-based access', 'Progress and time-on-step tracking', 'Certification and analytics for readiness']
    },
    {
      name: 'FlowDesk Delivery',
      code: 'FD',
      summary: 'Execution workspace for backlog, sprints, and operations improvements.',
      bullets: ['Board, backlog, and sprint views', 'Operational reporting for leadership', 'Connected to support process evolution']
    }
  ];
}

