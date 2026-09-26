import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-marketing-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './marketing-shell.html',
  styleUrls: ['./marketing-shell.css']
})
export class MarketingShell {
  readonly primaryLinks = [
    { label: 'Home', to: '/marketing' },
    { label: 'Platform', to: '/marketing/platform' },
    { label: 'Knowledge Base', to: '/help-center' },
    { label: 'Solutions', to: '/marketing/solutions' },
    { label: 'Integrations', to: '/marketing/integrations' },
    { label: 'Pricing', to: '/marketing/pricing' },
    { label: 'Security', to: '/marketing/security' },
    { label: 'Vs Zendesk', to: '/marketing/compare-zendesk' }
  ];
}
