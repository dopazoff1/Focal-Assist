import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface DealCard {
  title: string;
  company: string;
  value: string;
  probability: number;
  owner: string;
  ageDays: number;
}

interface Stage {
  name: string;
  wip: number;
  deals: DealCard[];
}

@Component({
  selector: 'app-v4-pipeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './v4-pipeline.html',
  styleUrls: ['../v4-shared/v4-page.css', './v4-pipeline.css']
})
export class V4PipelineComponent {
  readonly stages: Stage[] = [
    {
      name: 'New',
      wip: 7,
      deals: [
        { title: 'API automation package', company: 'Nordfin', value: '$18k', probability: 20, owner: 'Yuriy', ageDays: 1 },
        { title: 'Support redesign sprint', company: 'BlueField', value: '$12k', probability: 25, owner: 'Amine', ageDays: 2 }
      ]
    },
    {
      name: 'Qualified',
      wip: 5,
      deals: [
        { title: 'CRM migration rollout', company: 'Fintech Farm', value: '$46k', probability: 45, owner: 'Mona', ageDays: 4 },
        { title: 'Workflow governance', company: 'Atlas Pay', value: '$21k', probability: 40, owner: 'Nassim', ageDays: 3 }
      ]
    },
    {
      name: 'Proposal',
      wip: 4,
      deals: [
        { title: 'Ops orchestration bundle', company: 'Nexora', value: '$84k', probability: 62, owner: 'Yuriy', ageDays: 6 },
        { title: 'Training academy setup', company: 'Paybridge', value: '$27k', probability: 58, owner: 'Lina', ageDays: 5 }
      ]
    },
    {
      name: 'Negotiation',
      wip: 3,
      deals: [
        { title: 'Enterprise support plan', company: 'Forte Capital', value: '$110k', probability: 76, owner: 'Safa', ageDays: 8 }
      ]
    },
    {
      name: 'Won',
      wip: 2,
      deals: [
        { title: 'Omnichannel launch', company: 'Astera', value: '$95k', probability: 100, owner: 'Amine', ageDays: 0 }
      ]
    }
  ];
}
