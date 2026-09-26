import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LucideArrowRight, LucideArrowUpRight, LucideBookOpen, LucideSearch, LucideSparkles } from '@lucide/angular';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { KbHubSearchResult } from '../../services/kb';
import { KnowledgeHubIndex, KnowledgeHubService } from '../../services/knowledge-hub';

@Component({
  selector: 'app-knowledge-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideArrowRight, LucideArrowUpRight, LucideBookOpen, LucideSearch, LucideSparkles],
  templateUrl: './knowledge-hub.html',
  styleUrls: ['./knowledge-hub.css']
})
export class KnowledgeHubComponent implements OnInit, OnDestroy {
  index: KnowledgeHubIndex = { categories: [], articles: [] };
  searchTerm = '';
  searchSubmitted = false;
  searchSuggestions: KbHubSearchResult[] = [];
  searchResults: KbHubSearchResult[] = [];
  searchLoading = false;
  loading = true;
  private routeSub?: Subscription;
  private searchSub?: Subscription;
  private readonly searchRequests$ = new Subject<{ term: string; submitted: boolean }>();

  constructor(
    private hubService: KnowledgeHubService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.searchSub = this.searchRequests$.pipe(
      map(request => ({ ...request, term: request.term.trim() })),
      debounceTime(220),
      distinctUntilChanged((a, b) => a.term === b.term && a.submitted === b.submitted),
      switchMap(request => {
        if (!request.term) return of({ ...request, results: [] as KbHubSearchResult[] });
        return this.hubService.search(request.term, request.submitted ? 50 : 7).pipe(
          map(results => ({ ...request, results })),
          catchError(() => of({ ...request, results: [] as KbHubSearchResult[] }))
        );
      })
    ).subscribe(({ submitted, results }) => {
      this.searchLoading = false;
      if (submitted) {
        this.searchResults = results;
        this.searchSuggestions = [];
      } else {
        this.searchSuggestions = results;
        this.searchResults = [];
      }
    });

    this.routeSub = this.route.queryParamMap.subscribe(params => {
      this.searchTerm = params.get('q') || '';
      this.searchSubmitted = !!this.searchTerm;
      this.requestSearch(this.searchTerm, this.searchSubmitted);
    });

    this.hubService.loadIndex().subscribe({
      next: index => {
        this.index = index;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.searchSub?.unsubscribe();
  }

  get categoryCards() {
    return this.index.categories.map(category => ({
      category,
      articles: this.index.articles.filter(article => article.categoryId === category.id).slice(0, 3),
      total: this.index.articles.filter(article => article.categoryId === category.id).length
    }));
  }

  onSearchInput(): void {
    this.searchSubmitted = false;
    this.requestSearch(this.searchTerm, false);
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    const query = this.searchTerm.trim();
    this.searchSubmitted = !!query;
    this.requestSearch(query, !!query);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: query || null },
      queryParamsHandling: 'merge'
    });
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchSubmitted = false;
    this.searchSuggestions = [];
    this.searchResults = [];
    this.searchLoading = false;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge'
    });
  }

  openCategory(categoryId: number): void {
    void this.router.navigate(['/v3/knowledge-hub/category', categoryId]);
  }

  openArticle(articleId: number): void {
    void this.router.navigate(['/v3/knowledge-hub/article', articleId]);
  }

  getSnippet(article: KbHubSearchResult): string {
    return article.snippet || article.categoryName;
  }

  highlight(value: unknown): string {
    const text = this.escapeHtml(this.hubService.plainText(value));
    const term = this.hubService.plainText(this.searchTerm).trim();
    if (!term) return text;
    const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
  }

  trackByArticle(_: number, article: { id: number }): number {
    return article.id;
  }

  trackByCategory(_: number, card: { category: { id: number } }): number {
    return card.category.id;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));
  }

  private requestSearch(term: string, submitted: boolean): void {
    this.searchLoading = !!term.trim();
    this.searchRequests$.next({ term, submitted });
  }
}
