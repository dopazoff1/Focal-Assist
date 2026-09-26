import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type CompareRow = {
  capability: string;
  focal: string;
  zendesk: string;
};

@Component({
  selector: 'app-marketing-compare',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './marketing-compare.html',
  styleUrls: ['./marketing-compare.css']
})
export class MarketingCompare {
  readonly rows: CompareRow[] = [
    {
      capability: 'Decision-tree driven handling',
      focal: 'Native visual builder (Magic Assistance)',
      zendesk: 'Requires external apps / custom workflows'
    },
    {
      capability: 'KB + SOP map linkage',
      focal: 'Built-in article-to-map operational flow',
      zendesk: 'Guide-focused content, SOP maps are custom'
    },
    {
      capability: 'QA + adherence in same stack',
      focal: 'Integrated natively for supervisors and QA',
      zendesk: 'Typically split across add-ons and external BI'
    },
    {
      capability: 'Team mapping (TL/QA/Agent visibility)',
      focal: 'Role-graph support model available',
      zendesk: 'Group-based model, custom logic needed for parity'
    },
    {
      capability: 'Operational training academy',
      focal: 'Native course and progress layer',
      zendesk: 'Usually separate LMS product'
    },
    {
      capability: 'Fintech support playbook focus',
      focal: 'Built for KYC/Loan/Repayment workflows',
      zendesk: 'General-purpose platform'
    }
  ];
}

