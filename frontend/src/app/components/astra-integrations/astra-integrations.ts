import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AstraKbService, AstraLlmIntegration } from '../../services/astra-kb';

interface EditState {
  enabled: boolean;
  providerName: string;
  endpointUrl: string;
  modelName: string;
  apiKey: string;
  notes: string;
}

@Component({
  selector: 'app-astra-integrations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './astra-integrations.html',
  styleUrls: ['./astra-integrations.css']
})
export class AstraIntegrationsComponent implements OnInit {
  loading = false;
  error = '';
  success = '';

  integrations: AstraLlmIntegration[] = [];
  editingCode = '';
  savingCode = '';
  edit: EditState = {
    enabled: false,
    providerName: '',
    endpointUrl: '',
    modelName: '',
    apiKey: '',
    notes: ''
  };

  constructor(private astra: AstraKbService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.success = '';
    this.astra.listLlmIntegrations().subscribe({
      next: rows => {
        this.integrations = rows || [];
        if (this.editingCode) {
          const keep = this.integrations.find(x => x.providerCode === this.editingCode);
          if (!keep) {
            this.editingCode = '';
          }
        }
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'Could not load LLM integrations.';
      }
    });
  }

  startEdit(item: AstraLlmIntegration): void {
    this.success = '';
    this.error = '';
    this.editingCode = item.providerCode;
    this.edit = {
      enabled: !!item.enabled,
      providerName: item.providerName || '',
      endpointUrl: item.endpointUrl || '',
      modelName: item.modelName || '',
      apiKey: '',
      notes: item.notes || ''
    };
  }

  cancelEdit(): void {
    this.editingCode = '';
    this.savingCode = '';
  }

  save(): void {
    if (!this.editingCode || this.savingCode) {
      return;
    }
    this.savingCode = this.editingCode;
    this.error = '';
    this.success = '';

    this.astra
      .updateLlmIntegration(this.editingCode, {
        enabled: this.edit.enabled,
        providerName: this.edit.providerName.trim() || undefined,
        endpointUrl: this.edit.endpointUrl.trim() || undefined,
        modelName: this.edit.modelName.trim() || undefined,
        apiKey: this.edit.apiKey.trim() || undefined,
        notes: this.edit.notes.trim() || undefined
      })
      .subscribe({
        next: () => {
          this.savingCode = '';
          this.success = 'Integration updated.';
          this.editingCode = '';
          this.load();
        },
        error: err => {
          this.savingCode = '';
          this.error = err?.error?.message || err?.message || 'Could not update integration.';
        }
      });
  }

  isEditing(item: AstraLlmIntegration): boolean {
    return this.editingCode === item.providerCode;
  }
}
