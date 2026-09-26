import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-v5-design-system',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './v5-design-system.html',
  styleUrls: ['../v5-shared/v5-page.css', './v5-design-system.css']
})
export class V5DesignSystemComponent {
  readonly colorTokens = [
    { name: 'Primary / Trust', value: '#2563EB', role: 'Core CTA, links, focused actions' },
    { name: 'Success', value: '#16A34A', role: 'Wins, completed tasks, positive feedback' },
    { name: 'Background', value: '#F3F6FB', role: 'Main canvas for low cognitive load' },
    { name: 'Surface', value: '#FFFFFF', role: 'Cards, panels, inputs' },
    { name: 'Text Primary', value: '#0F172A', role: 'Primary readability and hierarchy' }
  ];

  readonly spacing = ['4px', '8px', '12px', '16px', '24px', '32px'];

  readonly motionRules = [
    'Micro interactions: 140-220ms, ease-out for hover and button feedback.',
    'Page transitions: 220-320ms, slide/fade only in content region.',
    'Progress and chart movement: 260-700ms, no looping flashy effects.',
    'Use motion to confirm status changes, not to decorate static content.'
  ];
}


