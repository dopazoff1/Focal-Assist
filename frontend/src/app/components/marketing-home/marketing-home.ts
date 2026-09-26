import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type ServiceCard = {
  code: string;
  title: string;
  summary: string;
};

type PlanPreview = {
  name: string;
  subtitle: string;
  price: string;
  points: string[];
  featured?: boolean;
};

type QuoteCard = {
  company: string;
  quote: string;
  author: string;
  role: string;
};

@Component({
  selector: 'app-marketing-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './marketing-home.html',
  styleUrls: ['./marketing-home.css']
})
export class MarketingHome {
  readonly trustedBrands: string[] = [
    'Fintech Farm',
    'NovaPay',
    'Orbit Bank',
    'Pulse Wallet',
    'SwiftCredit',
    'BlueLane'
  ];

  readonly services: ServiceCard[] = [
    {
      code: 'IN',
      title: 'CRM Inbox',
      summary: 'Omnichannel case handling with internal notes, ownership, SLA controls, and fast actions.'
    },
    {
      code: 'MA',
      title: 'Magic Assistance',
      summary: 'Decision trees guide agents step by step to consistent answers and lower handling time.'
    },
    {
      code: 'KB',
      title: 'Knowledge Base + SOP Maps',
      summary: 'Structured articles with interactive SOP maps to reduce guesswork and improve first-contact resolution.'
    },
    {
      code: 'QA',
      title: 'Quality + Adherence',
      summary: 'Score tickets, monitor timelines, and track adherence with role-based visibility by team.'
    },
    {
      code: 'AC',
      title: 'Training Academy',
      summary: 'Build courses, quizzes, and certifications while tracking progression and time-on-step per trainee.'
    },
    {
      code: 'FD',
      title: 'FlowDesk Delivery',
      summary: 'Operate initiatives across board, backlog, sprints, and reports in one operational layer.'
    }
  ];

  readonly rolloutSteps: string[] = [
    'Discovery + process mapping of current support operations.',
    'Configuration of roles, queues, taxonomies, and decision paths.',
    'Pilot launch with real traffic, QA calibration, and SLA tracking.',
    'Scale-up with governance, training, and continuous optimization.'
  ];

  readonly planPreview: PlanPreview[] = [
    {
      name: 'Starter',
      subtitle: 'For lean support teams',
      price: '$19',
      points: ['Core CRM workflows', 'Knowledge Base access', 'Standard support']
    },
    {
      name: 'Scale',
      subtitle: 'For growing fintech operations',
      price: '$39',
      points: ['Magic Assistance', 'QA + Adherence', 'Team management controls'],
      featured: true
    },
    {
      name: 'Enterprise',
      subtitle: 'For multi-team environments',
      price: 'Custom',
      points: ['Advanced governance', 'Custom integrations', 'Dedicated success lead']
    }
  ];

  readonly automationPoints: string[] = [
    'Auto-route conversations by language, segment, and customer priority.',
    'Trigger guided workflows the moment a customer opens a ticket.',
    'Escalate to the right team with SLA-aware handoff and audit trail.',
    'Tag every case automatically for analytics, QA, and training loops.'
  ];

  readonly integrations: string[] = [
    'Gmail',
    'WhatsApp Business',
    'Instagram',
    'Shopify',
    'HubSpot',
    'Salesforce',
    'Slack',
    'Zapier'
  ];

  readonly impactStats: Array<{ value: string; label: string }> = [
    { value: '5x', label: 'increase in agent productivity' },
    { value: '2x', label: 'improvement in customer satisfaction' },
    { value: '2x', label: 'improvement in response consistency' },
    { value: '99.9%', label: 'platform uptime target' }
  ];

  readonly testimonials: QuoteCard[] = [
    {
      company: 'Horizon Solutions',
      quote: 'Response time dropped significantly and our agents now follow one consistent support standard.',
      author: 'Sarah Lee',
      role: 'Head of Contact Center'
    },
    {
      company: 'MPG BPO',
      quote: 'Unified channels and guided workflows helped us scale operations without chaos.',
      author: 'James Carter',
      role: 'Operations Manager'
    }
  ];

}
