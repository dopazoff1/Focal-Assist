import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { AstraArticleDetails, AstraArticleSummary, AstraCategory, AstraFeedback, AstraKbService } from '../../services/astra-kb';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-astra-knowledge',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './astra-knowledge.html',
  styleUrls: ['./astra-knowledge.css']
})
export class AstraKnowledgeComponent implements OnInit {
  loading = false;
  loadingArticle = false;
  savingFeedback = false;
  error = '';
  categories: AstraCategory[] = [];
  articlesByCategory: Record<number, AstraArticleSummary[]> = {};
  selectedArticle: AstraArticleDetails | null = null;
  articleFeedback: AstraFeedback[] = [];
  search = '';

  feedbackSentiment: 'LIKE' | 'DISLIKE' = 'LIKE';
  feedbackText = '';

  private trackedThisSession = new Set<number>();

  constructor(
    private astra: AstraKbService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.search = (params.get('q') || '').trim();
      const article = Number(params.get('article') || '0');
      this.loadAll(Number.isFinite(article) && article > 0 ? article : null);
    });
  }

  loadAll(preselectArticleId: number | null): void {
    this.loading = true;
    this.error = '';
    this.astra.listCategories().subscribe({
      next: categories => {
        this.categories = categories || [];
        if (!this.categories.length) {
          this.articlesByCategory = {};
          this.selectedArticle = null;
          this.articleFeedback = [];
          this.loading = false;
          return;
        }

        const groupedCalls = this.categories.map(category => this.astra.listArticlesByCategory(category.id));
        forkJoin(groupedCalls.length ? groupedCalls : [of([])]).subscribe({
          next: groups => {
            const map: Record<number, AstraArticleSummary[]> = {};
            this.categories.forEach((category, idx) => {
              map[category.id] = groups[idx] || [];
            });
            this.articlesByCategory = map;

            const found = preselectArticleId ? this.findArticleById(preselectArticleId) : null;
            if (found) {
              this.selectArticle(found, false);
            } else if (!this.selectedArticle) {
              const first = this.firstAvailableArticle();
              if (first) {
                this.selectArticle(first, false);
              }
            }
            this.loading = false;
          },
          error: err => {
            this.loading = false;
            this.error = err?.error?.message || err?.message || 'Could not load Astra knowledge index.';
          }
        });
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'Could not load Astra categories.';
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

  clearSearch(): void {
    this.search = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge'
    });
  }

  selectArticle(article: AstraArticleSummary, updateUrl = true): void {
    this.loadingArticle = true;
    this.error = '';

    this.astra.getArticle(article.id).subscribe({
      next: details => {
        this.selectedArticle = details;
        this.loadingArticle = false;
        this.loadArticleFeedback(article.id);
        this.trackArticleIfNeeded(article.id);
        if (updateUrl) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { article: article.id },
            queryParamsHandling: 'merge'
          });
        }
      },
      error: err => {
        this.loadingArticle = false;
        this.error = err?.error?.message || err?.message || 'Could not load article details.';
      }
    });
  }

  submitFeedback(sentiment: 'LIKE' | 'DISLIKE'): void {
    if (!this.selectedArticle || this.savingFeedback) {
      return;
    }
    this.savingFeedback = true;
    this.feedbackSentiment = sentiment;
    const user = this.auth.getUser();
    this.astra
      .submitFeedback(this.selectedArticle.id, {
        sentiment,
        feedbackText: this.feedbackText.trim() || undefined,
        viewerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
        viewerEmail: user?.email || undefined
      })
      .subscribe({
        next: () => {
          this.feedbackText = '';
          this.savingFeedback = false;
          this.loadArticleFeedback(this.selectedArticle!.id);
        },
        error: err => {
          this.savingFeedback = false;
          this.error = err?.error?.message || err?.message || 'Could not submit feedback.';
        }
      });
  }

  private loadArticleFeedback(articleId: number): void {
    this.astra.listFeedback(articleId, 25).subscribe({
      next: rows => {
        this.articleFeedback = rows || [];
      },
      error: () => {
        this.articleFeedback = [];
      }
    });
  }

  private trackArticleIfNeeded(articleId: number): void {
    if (this.trackedThisSession.has(articleId)) {
      return;
    }
    this.trackedThisSession.add(articleId);
    const user = this.auth.getUser();
    this.astra
      .trackView(articleId, {
        sessionId: this.getSessionId(),
        source: 'ASTRA_INTERNAL',
        viewerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
        viewerEmail: user?.email || undefined
      })
      .subscribe({ error: () => void 0 });
  }

  private firstAvailableArticle(): AstraArticleSummary | null {
    for (const category of this.categories) {
      const rows = this.articlesByCategory[category.id] || [];
      if (rows.length > 0) {
        return rows[0];
      }
    }
    return null;
  }

  private findArticleById(id: number): AstraArticleSummary | null {
    for (const rows of Object.values(this.articlesByCategory)) {
      const hit = rows.find(row => row.id === id);
      if (hit) {
        return hit;
      }
    }
    return null;
  }

  private getSessionId(): string {
    if (typeof window === 'undefined') {
      return 'astra-server-session';
    }
    const key = 'astra_session_id';
    const existing = (localStorage.getItem(key) || '').trim();
    if (existing) {
      return existing;
    }
    const fresh = `as_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, fresh);
    return fresh;
  }
}
