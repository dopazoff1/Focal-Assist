import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type Billing = 'monthly' | 'annual';

type Plan = {
  key: 'starter' | 'scale' | 'enterprise';
  name: string;
  subtitle: string;
  monthly: string;
  annual: string;
  cta: string;
  featured?: boolean;
  features: string[];
};

type FeatureRow = {
  label: string;
  starter: boolean | string;
  scale: boolean | string;
  enterprise: boolean | string;
};

@Component({
  selector: 'app-marketing-pricing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './marketing-pricing.html',
  styleUrls: ['./marketing-pricing.css']
})
export class MarketingPricing {
  billing: Billing = 'monthly';

  readonly plans: Plan[] = [
    {
      key: 'starter',
      name: 'Starter',
      subtitle: 'For early-stage support operations',
      monthly: '$19',
      annual: '$15',
      cta: 'Start Pilot',
      features: ['Email case handling', 'Knowledge Base access', 'Basic reporting']
    },
    {
      key: 'scale',
      name: 'Scale',
      subtitle: 'For structured and growing teams',
      monthly: '$39',
      annual: '$31',
      cta: 'Book Demo',
      featured: true,
      features: ['Magic Assistance', 'QA evaluation', 'Adherence dashboard']
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      subtitle: 'For complex multi-team organizations',
      monthly: 'Custom',
      annual: 'Custom',
      cta: 'Talk To Sales',
      features: ['Custom workflows', 'Advanced governance', 'Priority success support']
    }
  ];

  readonly compareRows: FeatureRow[] = [
    { label: 'CRM case handling', starter: true, scale: true, enterprise: true },
    { label: 'Magic Assistance builder', starter: false, scale: true, enterprise: true },
    { label: 'KB map builder', starter: false, scale: true, enterprise: true },
    { label: 'QA evaluations', starter: false, scale: true, enterprise: true },
    { label: 'Adherence analytics', starter: false, scale: true, enterprise: true },
    { label: 'Training academy', starter: true, scale: true, enterprise: true },
    { label: 'Role-based governance', starter: 'Basic', scale: 'Advanced', enterprise: 'Custom policy' },
    { label: 'Support SLA', starter: 'Standard', scale: 'Priority', enterprise: 'Dedicated SLA' }
  ];

  readonly addons: Array<{ name: string; price: string; desc: string }> = [
    { name: 'Premium Onboarding', price: '$2,500 one-time', desc: 'Process mapping, setup, and go-live coaching.' },
    { name: 'Dedicated Success Lead', price: '$1,200 / month', desc: 'Weekly ops review and KPI action planning.' },
    { name: 'Custom Integration Pack', price: 'From $3,000', desc: 'API connectors, webhooks, and workflow automation.' }
  ];

  readonly faqs: Array<{ q: string; a: string }> = [
    {
      q: 'Do you offer pilot pricing?',
      a: 'Yes. Pilot packages are available and fully creditable toward annual subscription upon conversion.'
    },
    {
      q: 'Can we self-host?',
      a: 'Yes. Focal can be deployed in your environment with your security and network controls.'
    },
    {
      q: 'How are licenses counted?',
      a: 'Commercial plans are based on active operational users, with governance seats configured by contract.'
    }
  ];

  setBilling(next: Billing): void {
    this.billing = next;
  }

  displayPrice(plan: Plan): string {
    return this.billing === 'monthly' ? plan.monthly : plan.annual;
  }

  displayPeriod(plan: Plan): string {
    if (plan.key === 'enterprise') {
      return 'tailored scope';
    }
    return this.billing === 'monthly' ? '/ agent / month' : '/ agent / month, billed annually';
  }
}
