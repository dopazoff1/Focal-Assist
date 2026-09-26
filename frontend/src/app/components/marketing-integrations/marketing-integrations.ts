import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

type IntegrationGroup = {
  title: string;
  tools: string[];
};

@Component({
  selector: 'app-marketing-integrations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marketing-integrations.html',
  styleUrls: ['./marketing-integrations.css']
})
export class MarketingIntegrations {
  readonly groups: IntegrationGroup[] = [
    {
      title: 'Channels',
      tools: ['Gmail', 'WhatsApp Business', 'Instagram', 'Web Chat Widget']
    },
    {
      title: 'CRM & Data',
      tools: ['Salesforce', 'HubSpot', 'Pipedrive', 'Internal API Connector']
    },
    {
      title: 'Productivity',
      tools: ['Slack', 'Microsoft Teams', 'Google Workspace', 'Jira']
    },
    {
      title: 'Automation',
      tools: ['Zapier', 'Make', 'Webhooks', 'Scheduled Jobs']
    }
  ];

  readonly capabilities: string[] = [
    'Bi-directional ticket sync and status updates',
    'Role-based webhook security and scoped API keys',
    'Channel-level ownership and assignment rules',
    'Integration health monitoring and retry controls'
  ];
}

