import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { KbArticle, KbCategory, KbService } from '../../services/kb';

@Component({
  selector: 'app-marketing-knowledge-base',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marketing-knowledge-base.html',
  styleUrls: ['./marketing-knowledge-base.css']
})
export class MarketingKnowledgeBase implements OnInit {
  loading = false;
  usingDemoContent = false;
  hasKnowledgeLoaded = false;
  searchTerm = '';
  selectedCategoryId: number | null = null;
  selectedArticle: KbArticle | null = null;
  requestedArticleId: number | null = null;

  categories: KbCategory[] = [];
  articlesByCategory: Record<number, KbArticle[]> = {};

  constructor(
    private kbService: KbService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const articleRaw = params.get('article');
      const parsed = articleRaw ? Number(articleRaw) : NaN;
      this.requestedArticleId = Number.isFinite(parsed) ? parsed : null;

      const q = params.get('q');
      this.searchTerm = q ? q.toString() : '';

      const matched = this.trySelectRequestedArticle();
      if (!matched && this.hasKnowledgeLoaded && this.requestedArticleId !== null) {
        this.goToArticleNotFound(this.requestedArticleId);
      }
    });

    this.loadKnowledge();
  }

  get totalArticles(): number {
    return Object.values(this.articlesByCategory).reduce((sum, list) => sum + list.length, 0);
  }

  get categoryList(): KbCategory[] {
    return this.categories.filter(cat => this.getVisibleArticles(cat.id).length > 0);
  }

  get selectedCategoryArticles(): KbArticle[] {
    if (this.selectedCategoryId === null) return [];
    return this.getVisibleArticles(this.selectedCategoryId);
  }

  clearSearch(): void {
    this.searchTerm = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge'
    });
    this.ensureSelection();
  }

  selectCategory(categoryId: number): void {
    this.selectedCategoryId = categoryId;
    this.ensureSelection();
  }

  openArticle(article: KbArticle): void {
    this.selectedArticle = article;
    this.selectedCategoryId = article.categoryId ?? this.selectedCategoryId;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { article: article.id },
      queryParamsHandling: 'merge'
    });
  }

  copyArticleLink(article: KbArticle): void {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { article: article.id },
      queryParamsHandling: 'merge'
    });
    const url = `${window.location.origin}${this.router.serializeUrl(tree)}`;
    void navigator.clipboard.writeText(url);
  }

  getCategoryCount(categoryId: number): number {
    return this.getVisibleArticles(categoryId).length;
  }

  getArticlePreview(content: string): string {
    const plain = (content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) return 'No preview available.';
    return plain.length > 155 ? `${plain.slice(0, 152)}...` : plain;
  }

  private loadKnowledge(): void {
    this.loading = true;
    this.usingDemoContent = false;

    this.kbService.getCategories().subscribe({
      next: categories => {
        const ordered = [...categories].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        if (!ordered.length) {
          this.loadDemoContent();
          return;
        }

        const requests = ordered.map(cat => this.kbService.getArticlesByCategory(cat.id));
        if (!requests.length) {
          this.loadDemoContent();
          return;
        }

        forkJoin(requests).subscribe({
          next: grouped => {
            this.categories = ordered;
            this.articlesByCategory = {};

            ordered.forEach((cat, idx) => {
              const list = (grouped[idx] || [])
                .filter(article => article.isActive !== false)
                .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                .map(article => ({ ...article, categoryId: cat.id }));
              this.articlesByCategory[cat.id] = list;
            });

            if (this.totalArticles === 0) {
              this.loadDemoContent();
              return;
            }

             this.ensureSelection();
            const matched = this.trySelectRequestedArticle();
            this.hasKnowledgeLoaded = true;
            if (!matched && this.requestedArticleId !== null) {
              this.loading = false;
              this.goToArticleNotFound(this.requestedArticleId);
              return;
            }
            this.loading = false;
          },
          error: () => this.loadDemoContent()
        });
      },
      error: () => this.loadDemoContent()
    });
  }

  private getVisibleArticles(categoryId: number): KbArticle[] {
    const list = this.articlesByCategory[categoryId] || [];
    if (!this.searchTerm) return list;
    const q = this.searchTerm.toLowerCase();
    return list.filter(article =>
      article.title.toLowerCase().includes(q) ||
      (article.content || '').toLowerCase().includes(q)
    );
  }

  private ensureSelection(): void {
    if (this.selectedCategoryId === null || this.getCategoryCount(this.selectedCategoryId) === 0) {
      const firstCategory = this.categoryList[0];
      this.selectedCategoryId = firstCategory ? firstCategory.id : null;
    }

    if (this.selectedCategoryId === null) {
      this.selectedArticle = null;
      return;
    }

    const currentVisible = this.selectedCategoryArticles;
    const selectedStillVisible = this.selectedArticle
      ? currentVisible.some(article => article.id === this.selectedArticle?.id)
      : false;
    if (!selectedStillVisible) {
      this.selectedArticle = currentVisible.length ? currentVisible[0] : null;
    }
  }

  private trySelectRequestedArticle(): boolean {
    if (this.requestedArticleId === null) return false;
    const allArticles = Object.values(this.articlesByCategory).flat();
    const match = allArticles.find(article => article.id === this.requestedArticleId);
    if (!match) return false;

    this.selectedCategoryId = match.categoryId ?? this.selectedCategoryId;
    this.selectedArticle = match;
    return true;
  }

  private loadDemoContent(): void {
    this.usingDemoContent = true;

    const categories: KbCategory[] = [
      { id: 501, name: 'Getting Started', displayOrder: 1 },
      { id: 502, name: 'Account & Security', displayOrder: 2 },
      { id: 503, name: 'Payments & Limits', displayOrder: 3 }
    ];

    const articlesByCategory: Record<number, KbArticle[]> = {
      501: [
        {
          id: 9101,
          categoryId: 501,
          title: 'How do I start using Focal?',
          content: '<p>Sign in, open your workspace, and follow the onboarding checklist to activate key modules.</p>'
        },
        {
          id: 9102,
          categoryId: 501,
          title: 'How to navigate the command center',
          content: '<p>Use the left navigation to open CRM, Magic Assistance, and Knowledge Base while keeping context.</p>'
        }
      ],
      502: [
        {
          id: 9201,
          categoryId: 502,
          title: 'How to reset account password securely',
          content: '<p>Go to profile settings, trigger reset, and confirm identity with your configured verification method.</p>'
        },
        {
          id: 9202,
          categoryId: 502,
          title: 'What to do if the account is blocked',
          content: '<p>Validate reason code, check risk flags, and use approved unblock workflow before customer response.</p>'
        }
      ],
      503: [
        {
          id: 9301,
          categoryId: 503,
          title: 'Why did my transfer fail?',
          content: '<p>Transfer failures can be caused by limits, verification state, or beneficiary restrictions.</p>'
        },
        {
          id: 9302,
          categoryId: 503,
          title: 'Understanding daily payment limits',
          content: '<p>Limits vary by profile and risk tier. Review current limits from account settings and recent events.</p>'
        }
      ]
    };

    this.categories = categories;
    this.articlesByCategory = articlesByCategory;
    this.ensureSelection();
    const matched = this.trySelectRequestedArticle();
    this.hasKnowledgeLoaded = true;
    if (!matched && this.requestedArticleId !== null) {
      this.loading = false;
      this.goToArticleNotFound(this.requestedArticleId);
      return;
    }
    this.loading = false;
  }

  private goToArticleNotFound(articleId: number): void {
    void this.router.navigate(['/article-not-found'], {
      queryParams: {
        article: articleId,
        from: 'public-knowledge-base'
      }
    });
  }
}
