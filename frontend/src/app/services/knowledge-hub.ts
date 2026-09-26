import { Injectable } from '@angular/core';
import { Observable, map, of, shareReplay, switchMap } from 'rxjs';
import {
  KbArticle,
  KbArticleMap,
  KbHubArticleSummary,
  KbHubCategorySummary,
  KbHubSearchResult,
  KbService
} from './kb';

export interface KnowledgeHubArticleSummary extends KbHubArticleSummary {}

export interface KnowledgeHubArticle extends KbArticle {
  categoryName: string;
  map: KbArticleMap | null;
  hasMap: boolean;
}

export interface KnowledgeHubIndex {
  categories: KbHubCategorySummary[];
  articles: KnowledgeHubArticleSummary[];
}

@Injectable({ providedIn: 'root' })
export class KnowledgeHubService {
  private index$?: Observable<KnowledgeHubIndex>;
  private readonly articleCache = new Map<number, Observable<KnowledgeHubArticle | undefined>>();
  private readonly mapCache = new Map<number, Observable<KbArticleMap>>();

  constructor(private kbService: KbService) {}

  loadIndex(): Observable<KnowledgeHubIndex> {
    if (!this.index$) {
      this.index$ = this.kbService.getHubIndex().pipe(
        map(response => ({
          categories: response.categories || [],
          articles: response.articles || []
        })),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.index$;
  }

  search(term: string, limit = 7): Observable<KbHubSearchResult[]> {
    const query = this.plainText(term).trim();
    return query ? this.kbService.searchHub(query, limit) : of([]);
  }

  loadArticle(articleId: number): Observable<KnowledgeHubArticle | undefined> {
    const cached = this.articleCache.get(articleId);
    if (cached) return cached;

    const article$ = this.loadIndex().pipe(
      switchMap(index => {
        const summary = index.articles.find(article => article.id === articleId);
        if (!summary) return of(undefined);
        return this.kbService.getArticleById(articleId).pipe(
          map(article => article ? {
            ...article,
            categoryId: article.category?.id ?? summary.categoryId,
            categoryName: article.category?.name || summary.categoryName,
            map: null,
            hasMap: summary.hasMap
          } : undefined)
        );
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.articleCache.set(articleId, article$);
    return article$;
  }

  loadMap(articleId: number): Observable<KbArticleMap> {
    const cached = this.mapCache.get(articleId);
    if (cached) return cached;
    const map$ = this.kbService.getArticleMap(articleId).pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.mapCache.set(articleId, map$);
    return map$;
  }

  plainText(value: unknown): string {
    return String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalize(value: unknown): string {
    return this.plainText(value).toLowerCase();
  }
}
