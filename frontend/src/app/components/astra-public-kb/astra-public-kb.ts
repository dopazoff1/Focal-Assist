import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AstraArticleDetails, AstraArticleSummary, AstraCategory, AstraKbService } from '../../services/astra-kb';

@Component({
  selector: 'app-astra-public-kb',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './astra-public-kb.html',
  styleUrls: ['./astra-public-kb.css']
})
export class AstraPublicKbComponent implements OnInit {
  loading = false;
  loadingArticle = false;
  error = '';
  success = '';
  categories: AstraCategory[] = [];
  articlesByCategory: Record<number, AstraArticleSummary[]> = {};
  selectedArticle: AstraArticleDetails | null = null;
  search = '';

  requesterName = '';
  requesterEmail = '';
  requesterCompany = '';
  ticketSubject = '';
  ticketDescription = '';
  ticketPriority = 'NORMAL';
  creatingTicket = false;

  feedbackSentiment: 'LIKE' | 'DISLIKE' = 'LIKE';
  feedbackText = '';
  feedbackName = '';
  feedbackEmail = '';
  submittingFeedback = false;

  private tracked = new Set<number>();

  constructor(private astra: AstraKbService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.success = '';
    this.astra.listPublicCategories().subscribe({
      next: categories => {
        this.categories = categories || [];
        if (!this.categories.length) {
          this.articlesByCategory = {};
          this.loading = false;
          return;
        }
        let pending = this.categories.length;
        for (const category of this.categories) {
          this.astra.listPublicArticlesByCategory(category.id).subscribe({
            next: rows => {
              this.articlesByCategory[category.id] = rows || [];
              pending -= 1;
              if (pending <= 0) {
                this.loading = false;
                if (!this.selectedArticle) {
                  const first = this.firstArticle();
                  if (first) {
                    this.selectArticle(first);
                  }
                }
              }
            },
            error: () => {
              this.articlesByCategory[category.id] = [];
              pending -= 1;
              if (pending <= 0) {
                this.loading = false;
              }
            }
          });
        }
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'Could not load public knowledge base.';
      }
    });
  }

  get filteredCategories(): AstraCategory[] {
    return this.categories.filter(category => this.filteredArticles(category.id).length > 0);
  }

  filteredArticles(categoryId: number): AstraArticleSummary[] {
    const list = this.articlesByCategory[categoryId] || [];
    const query = this.search.trim().toLowerCase();
    if (!query) {
      return list;
    }
    return list.filter(article => article.title.toLowerCase().includes(query));
  }

  selectArticle(article: AstraArticleSummary): void {
    this.loadingArticle = true;
    this.error = '';
    this.success = '';

    this.astra.getPublicArticle(article.id).subscribe({
      next: details => {
        this.selectedArticle = details;
        this.ticketSubject = details.title;
        this.loadingArticle = false;
        this.trackView(details.id);
      },
      error: err => {
        this.loadingArticle = false;
        this.error = err?.error?.message || err?.message || 'Could not load this article.';
      }
    });
  }

  sendFeedback(sentiment: 'LIKE' | 'DISLIKE'): void {
    if (!this.selectedArticle || this.submittingFeedback) {
      return;
    }
    this.submittingFeedback = true;
    this.feedbackSentiment = sentiment;
    this.error = '';
    this.success = '';
    this.astra
      .submitPublicFeedback(this.selectedArticle.id, {
        sentiment,
        feedbackText: this.feedbackText.trim() || undefined,
        viewerName: this.feedbackName.trim() || undefined,
        viewerEmail: this.feedbackEmail.trim() || undefined
      })
      .subscribe({
        next: () => {
          this.submittingFeedback = false;
          this.feedbackText = '';
          this.success = 'Thank you for your feedback.';
        },
        error: err => {
          this.submittingFeedback = false;
          this.error = err?.error?.message || err?.message || 'Could not submit feedback.';
        }
      });
  }

  createTicket(): void {
    if (!this.ticketSubject.trim() || !this.ticketDescription.trim() || !this.requesterName.trim() || !this.requesterEmail.trim()) {
      this.error = 'Name, email, subject and description are required.';
      return;
    }
    this.creatingTicket = true;
    this.error = '';
    this.success = '';
    this.astra
      .createPublicTicket({
        articleId: this.selectedArticle?.id || null,
        requesterName: this.requesterName.trim(),
        requesterEmail: this.requesterEmail.trim(),
        requesterCompany: this.requesterCompany.trim() || undefined,
        subject: this.ticketSubject.trim(),
        description: this.ticketDescription.trim(),
        priority: this.ticketPriority
      })
      .subscribe({
        next: (result: any) => {
          this.creatingTicket = false;
          this.ticketDescription = '';
          const key = result?.ticket?.ticketKey || '';
          this.success = key ? `Ticket created: ${key}` : 'Ticket created successfully.';
        },
        error: err => {
          this.creatingTicket = false;
          this.error = err?.error?.message || err?.message || 'Could not create ticket.';
        }
      });
  }

  private trackView(articleId: number): void {
    if (this.tracked.has(articleId)) {
      return;
    }
    this.tracked.add(articleId);
    this.astra
      .trackPublicView(articleId, {
        sessionId: this.getSessionId(),
        source: 'ASTRA_PUBLIC_PREVIEW',
        viewerName: this.feedbackName.trim() || undefined,
        viewerEmail: this.feedbackEmail.trim() || undefined
      })
      .subscribe({ error: () => void 0 });
  }

  private firstArticle(): AstraArticleSummary | null {
    for (const category of this.categories) {
      const list = this.articlesByCategory[category.id] || [];
      if (list.length > 0) {
        return list[0];
      }
    }
    return null;
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') {
      return 'astra-public-server';
    }
    const key = 'astra_public_session';
    const existing = (localStorage.getItem(key) || '').trim();
    if (existing) {
      return existing;
    }
    const fresh = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, fresh);
    return fresh;
  }
}
