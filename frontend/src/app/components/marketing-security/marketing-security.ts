import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-marketing-security',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marketing-security.html',
  styleUrls: ['./marketing-security.css']
})
export class MarketingSecurity {
  readonly controls = [
    'Role-based access with granular permissions by function',
    'Account lifecycle controls (activation, deactivation, reset)',
    'Operational audit trail for ticket actions and evaluations',
    'Segregated access by team mapping and organizational scope'
  ];

  readonly deployment = [
    'Self-hosted or managed deployment model',
    'API proxy support and custom domain options',
    'Environment-specific configuration and controlled releases',
    'Backup and disaster recovery compatible architecture'
  ];

  readonly operations = [
    'Uptime objective with proactive monitoring',
    'Incident response and root-cause documentation',
    'Secure integration pattern with external channels',
    'Production rollout checklist with governance validation'
  ];
}

