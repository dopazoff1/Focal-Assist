import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowRight, LucideCheck, LucideMessageSquare, LucideRefreshCw, LucideX } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { MermaidContentDirective } from '../../directives/mermaid-content';
import {
  KbArticleDraft,
  KbValidationCommentRequest,
  KbValidationQueueItem,
  KbService
} from '../../services/kb';

@Component({
  selector: 'app-article-validation',
  standalone: true,
  imports: [CommonModule, FormsModule, MermaidContentDirective, LucideArrowRight, LucideCheck, LucideMessageSquare, LucideRefreshCw, LucideX],
  templateUrl: './article-validation.html',
  styleUrls: ['./article-validation.css']
})
export class ArticleValidationComponent implements OnInit, OnDestroy {
  queue: KbValidationQueueItem[] = [];
  selected?: KbArticleDraft;
  selectedText = '';
  selectedSelector = '';
  commentText = '';
  loading = true;
  saving = false;
  errorMessage = '';
  statusMessage = '';
  private queueSub?: Subscription;

  constructor(private kbService: KbService) {}

  ngOnInit(): void {
    this.loadQueue();
  }

  ngOnDestroy(): void {
    this.queueSub?.unsubscribe();
  }

  loadQueue(): void {
    this.loading = true;
    this.errorMessage = '';
    this.queueSub?.unsubscribe();
    this.queueSub = this.kbService.getValidationQueue().subscribe({
      next: queue => {
        this.queue = queue || [];
        this.loading = false;
        if (this.selected && !this.queue.some(item => item.revisionId === this.selected?.revisionId)) {
          this.selected = undefined;
        }
      },
      error: error => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'Could not load the validation queue.';
      }
    });
  }

  openRevision(item: KbValidationQueueItem): void {
    this.errorMessage = '';
    this.statusMessage = '';
    this.selectedText = '';
    this.selectedSelector = '';
    this.commentText = '';
    this.kbService.getValidationRevision(item.revisionId).subscribe({
      next: revision => this.selected = revision,
      error: error => this.errorMessage = error?.error?.message || 'Could not open this revision.'
    });
  }

  captureSelection(event: MouseEvent): void {
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    const text = selection?.toString().trim() || '';
    if (!text) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.review-content')) return;
    this.selectedText = text.slice(0, 2000);
    this.selectedSelector = this.buildSelector(target);
  }

  addComment(): void {
    if (!this.selected?.revisionId || !this.commentText.trim()) return;
    this.saving = true;
    this.kbService.addValidationComment(this.selected.revisionId, this.commentPayload()).subscribe({
      next: revision => {
        this.selected = revision;
        this.commentText = '';
        this.saving = false;
        this.statusMessage = 'Comment added to the revision.';
      },
      error: error => {
        this.saving = false;
        this.errorMessage = error?.error?.message || 'Could not add comment.';
      }
    });
  }

  approve(): void {
    if (!this.selected?.revisionId) return;
    this.saving = true;
    this.kbService.approveArticleRevision(this.selected.revisionId).subscribe({
      next: revision => {
        this.saving = false;
        this.selected = revision;
        this.statusMessage = revision.status === 'APPROVED'
          ? 'Revision approved and published.'
          : 'Revision approved and sent to the next validator.';
        this.loadQueue();
      },
      error: error => {
        this.saving = false;
        this.errorMessage = error?.error?.message || 'Could not approve this revision.';
      }
    });
  }

  reject(): void {
    if (!this.selected?.revisionId || !this.commentText.trim()) {
      this.errorMessage = 'Add a comment explaining what the article maker must change.';
      return;
    }
    this.saving = true;
    this.kbService.rejectArticleRevision(this.selected.revisionId, this.commentPayload()).subscribe({
      next: revision => {
        this.saving = false;
        this.selected = revision;
        this.statusMessage = 'Revision returned to the article maker.';
        this.loadQueue();
      },
      error: error => {
        this.saving = false;
        this.errorMessage = error?.error?.message || 'Could not reject this revision.';
      }
    });
  }

  get approvalLabel(): string {
    return this.selected && this.selected.currentStep + 1 < this.selected.validationChain.length
      ? 'Approve and send next'
      : 'Approve and publish';
  }

  trackByRevision(_: number, item: KbValidationQueueItem): number {
    return item.revisionId;
  }

  trackByComment(_: number, comment: { id?: number }): number | undefined {
    return comment.id;
  }

  private commentPayload(): KbValidationCommentRequest {
    return {
      selector: this.selectedSelector,
      selectedText: this.selectedText,
      comment: this.commentText.trim()
    };
  }

  private buildSelector(element: HTMLElement): string {
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    while (current && !current.classList.contains('review-content') && parts.length < 4) {
      const siblings = current.parentElement ? Array.from(current.parentElement.children).filter(child => child.tagName === current!.tagName) : [];
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${index})`);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }
}
