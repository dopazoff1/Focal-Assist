import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface LeadFormModel {
  fullName: string;
  email: string;
  company: string;
  role: string;
  source: string;
  dealValue: string;
  priority: string;
  nextActionDate: string;
  notes: string;
}

@Component({
  selector: 'app-v4-forms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './v4-forms.html',
  styleUrls: ['../v4-shared/v4-page.css', './v4-forms.css']
})
export class V4FormsComponent {
  submitted = false;
  saved = false;

  model: LeadFormModel = {
    fullName: '',
    email: '',
    company: '',
    role: '',
    source: '',
    dealValue: '',
    priority: 'normal',
    nextActionDate: '',
    notes: ''
  };

  readonly sources = ['Website chat', 'Inbound email', 'Referral', 'Outbound campaign', 'Partner'];

  get completionPercent(): number {
    const required = [
      this.model.fullName,
      this.model.email,
      this.model.company,
      this.model.source,
      this.model.dealValue,
      this.model.nextActionDate
    ];
    const done = required.filter(v => (v || '').trim().length > 0).length;
    return Math.round((done / required.length) * 100);
  }

  get canSubmit(): boolean {
    return this.completionPercent === 100;
  }

  submit(): void {
    this.submitted = true;
    if (!this.canSubmit) {
      this.saved = false;
      return;
    }
    this.saved = true;
  }
}
