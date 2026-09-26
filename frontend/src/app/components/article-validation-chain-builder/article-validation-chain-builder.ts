import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { KbService, KbValidationStep, KbValidationUser } from '../../services/kb';
import { ArticleValidationChainComponent } from '../article-validation-chain/article-validation-chain';

@Component({
  selector: 'app-article-validation-chain-builder',
  standalone: true,
  imports: [CommonModule, RouterModule, ArticleValidationChainComponent],
  templateUrl: './article-validation-chain-builder.html',
  styleUrls: ['./article-validation-chain-builder.css']
})
export class ArticleValidationChainBuilderComponent implements OnInit {
  users: KbValidationUser[] = [];
  selectedUserIds: number[] = [];
  loading = false;
  saving = false;
  statusMessage = '';
  errorMessage = '';

  constructor(private kbService: KbService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({ users: this.kbService.getValidationEligibleUsers(), chain: this.kbService.getValidationChain() }).subscribe({
      next: ({ users, chain }) => {
        this.users = this.mergeUsers(users, chain);
        this.selectedUserIds = chain.sort((a, b) => a.stepOrder - b.stepOrder).map(step => step.reviewer.id);
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.errorMessage = err?.error?.message || err?.message || 'Could not load the validation chain.';
      }
    });
  }

  save(): void {
    this.saving = true;
    this.errorMessage = '';
    this.statusMessage = '';
    this.kbService.saveValidationChain(this.selectedUserIds).subscribe({
      next: chain => {
        this.selectedUserIds = chain.sort((a, b) => a.stepOrder - b.stepOrder).map(step => step.reviewer.id);
        this.saving = false;
        this.statusMessage = 'Global validation chain saved. New submissions will use this order.';
      },
      error: err => {
        this.saving = false;
        this.errorMessage = err?.error?.message || err?.message || 'Could not save the validation chain.';
      }
    });
  }

  get selectedUsers(): KbValidationUser[] {
    const byId = new Map(this.users.map(user => [user.id, user]));
    return this.selectedUserIds
      .map(id => byId.get(id))
      .filter((user): user is KbValidationUser => !!user);
  }

  get availableUsers(): KbValidationUser[] {
    const selected = new Set(this.selectedUserIds);
    return this.users.filter(user => !selected.has(user.id));
  }

  addReviewer(userId: number): void {
    if (!this.selectedUserIds.includes(userId)) {
      this.selectedUserIds = [...this.selectedUserIds, userId];
    }
  }

  removeReviewer(userId: number): void {
    this.selectedUserIds = this.selectedUserIds.filter(id => id !== userId);
  }

  private mergeUsers(users: KbValidationUser[], chain: KbValidationStep[]): KbValidationUser[] {
    const merged = new Map<number, KbValidationUser>(users.map(user => [user.id, user]));
    for (const step of chain) {
      if (!merged.has(step.reviewer.id)) merged.set(step.reviewer.id, step.reviewer);
    }
    return [...merged.values()];
  }
}
