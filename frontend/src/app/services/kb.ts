import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

export interface KbCategory {
  id: number;
  name: string;
  displayOrder?: number;
}

export interface KbArticle {
  id: number;
  title: string;
  content: string;
  categoryId?: number;
  category?: KbCategory;
  displayOrder?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface KbHubArticleSummary {
  id: number;
  title: string;
  categoryId?: number;
  categoryName: string;
  displayOrder?: number;
  isActive?: boolean;
  hasMap: boolean;
}

export interface KbHubCategorySummary {
  id: number;
  name: string;
  articleCount: number;
}

export interface KbHubIndexResponse {
  categories: KbHubCategorySummary[];
  articles: KbHubArticleSummary[];
}

export interface KbHubSearchResult extends KbHubArticleSummary {
  snippet: string;
}

export interface KbArticleCreateRequest {
  categoryId: number;
  title: string;
  content?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export type KbRevisionStatus = 'DRAFT' | 'PENDING_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED';

export interface KbValidationUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface KbValidationStep {
  id?: number;
  stepOrder: number;
  reviewer: KbValidationUser;
}

export interface KbValidationComment {
  id?: number;
  selector?: string;
  selectedText?: string;
  comment: string;
  author: KbValidationUser;
  createdAt?: string;
}

export interface KbArticleDraft {
  revisionId?: number;
  articleId: number;
  title: string;
  content: string;
  categoryId?: number;
  categoryName: string;
  displayOrder?: number;
  requestedActive: boolean;
  status?: KbRevisionStatus;
  currentStep: number;
  rejectionReason?: string;
  submittedAt?: string;
  validationChain: KbValidationStep[];
  comments: KbValidationComment[];
}

export interface KbArticleDraftRequest {
  categoryId: number;
  title: string;
  content: string;
  displayOrder?: number;
  requestedActive?: boolean;
  validatorUserIds?: number[];
}

export interface KbValidationQueueItem {
  revisionId: number;
  articleId: number;
  title: string;
  categoryName: string;
  makerName: string;
  submittedAt?: string;
  currentStep: number;
  totalSteps: number;
}

export interface KbValidationCommentRequest {
  selector?: string;
  selectedText?: string;
  comment: string;
}

export interface KbMapNode {
  id: number;
  articleId?: number;
  title?: string;
  label?: string;
  content?: string;
  xPos?: number;
  yPos?: number;
  x?: number;
  y?: number;
  isStart?: boolean;
}

export interface KbMapEdge {
  id: number;
  sourceNodeId: number;
  targetNodeId: number;
  label: string;
  displayOrder?: number;
}

export interface KbArticleMap {
  articleId?: number;
  nodes: KbMapNode[];
  edges: KbMapEdge[];
}

export interface KbMapSavePayload {
  articleId?: number;
  nodes: KbMapNode[];
  edges: KbMapEdge[];
}

export interface KbMapSaveResponse {
  success?: boolean;
  pendingValidation?: boolean;
  message?: string;
}

export interface KbArticleFeedbackRequest {
  sentiment: 'LIKE' | 'DISLIKE';
  feedbackText?: string;
  viewerName?: string;
  viewerEmail?: string;
}

export interface KbTrackArticleTimeRequest {
  articleId: number;
  secondsSpent: number;
  sessionId?: string;
  source?: string;
}

export interface KbAnalyticsTotals {
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  trackedEvents: number;
  uniqueArticles: number;
  uniqueUsers: number;
  avgMinutesPerArticle: number;
  avgMinutesPerUser: number;
}

export interface KbAnalyticsArticleRow {
  articleId: number;
  title: string;
  category: string;
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  viewers: number;
  eventCount: number;
  lastTrackedAt: string;
}

export interface KbAnalyticsAgentRow {
  userId?: number;
  name: string;
  email: string;
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  articlesCount: number;
  topArticleId?: number;
  topArticleTitle?: string;
  topArticleSeconds?: number;
  lastTrackedAt: string;
}

export interface KbAnalyticsArticleAgentRow {
  articleId: number;
  title: string;
  category: string;
  userId?: number;
  name: string;
  email: string;
  seconds: number;
  minutes: number;
}

export interface KbAnalyticsRecentRow {
  articleId: number;
  title: string;
  category: string;
  userId?: number;
  name: string;
  email: string;
  seconds: number;
  minutes: number;
  source: string;
  sessionId: string;
  trackedAt: string;
}

export interface KbAnalyticsDashboard {
  periodDays: number;
  generatedAt: string;
  totals: KbAnalyticsTotals;
  articles: KbAnalyticsArticleRow[];
  agents: KbAnalyticsAgentRow[];
  articleAgents: KbAnalyticsArticleAgentRow[];
  recent: KbAnalyticsRecentRow[];
}

@Injectable({
  providedIn: 'root'
})
export class KbService {
  private readonly API_URL = '/api/kb';
  private readonly KB_MAP_URL = '/api/kb-map';
  private readonly KB_ANALYTICS_URL = '/api/kb/analytics';

  constructor(private http: HttpClient) {}

  getCategories(): Observable<KbCategory[]> {
    return this.http.get<KbCategory[]>(`${this.API_URL}/categories`);
  }

  getArticlesByCategory(categoryId: number): Observable<KbArticle[]> {
    return this.http.get<KbArticle[]>(`${this.API_URL}/articles/category/${categoryId}`);
  }

  getArticlesByCategoryManagement(categoryId: number, includeInactive = true): Observable<KbArticle[]> {
    return this.http.get<KbArticle[]>(
      `${this.API_URL}/articles/category/${categoryId}?includeInactive=${includeInactive}`
    );
  }

  getAllArticles(): Observable<KbArticle[]> {
    return this.http.get<KbArticle[]>(`${this.API_URL}/articles`);
  }

  getArticleById(id: number): Observable<KbArticle> {
    return this.http.get<KbArticle>(`${this.API_URL}/articles/${id}`);
  }

  getArticleDraft(id: number): Observable<KbArticleDraft> {
    return this.http.get<KbArticleDraft>(`${this.API_URL}/articles/${id}/draft`);
  }

  saveArticleDraft(id: number, payload: KbArticleDraftRequest): Observable<KbArticleDraft> {
    return this.http.put<KbArticleDraft>(`${this.API_URL}/articles/${id}/draft`, payload);
  }

  getValidationEligibleUsers(): Observable<KbValidationUser[]> {
    return this.http.get<KbValidationUser[]>('/api/kb/validation/eligible-users');
  }

  getValidationChain(): Observable<KbValidationStep[]> {
    return this.http.get<KbValidationStep[]>('/api/kb/validation/chain');
  }

  saveValidationChain(reviewerUserIds: number[]): Observable<KbValidationStep[]> {
    return this.http.put<KbValidationStep[]>('/api/kb/validation/chain', { reviewerUserIds });
  }

  getValidationQueue(): Observable<KbValidationQueueItem[]> {
    return this.http.get<KbValidationQueueItem[]>('/api/kb/validation/queue');
  }

  getValidationRevision(revisionId: number): Observable<KbArticleDraft> {
    return this.http.get<KbArticleDraft>(`/api/kb/validation/revisions/${revisionId}`);
  }

  submitArticleRevision(revisionId: number): Observable<KbArticleDraft> {
    return this.http.post<KbArticleDraft>(`/api/kb/validation/revisions/${revisionId}/submit`, {});
  }

  addValidationComment(revisionId: number, payload: KbValidationCommentRequest): Observable<KbArticleDraft> {
    return this.http.post<KbArticleDraft>(`/api/kb/validation/revisions/${revisionId}/comment`, payload);
  }

  approveArticleRevision(revisionId: number): Observable<KbArticleDraft> {
    return this.http.post<KbArticleDraft>(`/api/kb/validation/revisions/${revisionId}/approve`, {});
  }

  rejectArticleRevision(revisionId: number, payload: KbValidationCommentRequest): Observable<KbArticleDraft> {
    return this.http.post<KbArticleDraft>(`/api/kb/validation/revisions/${revisionId}/reject`, payload);
  }

  getHubIndex(): Observable<KbHubIndexResponse> {
    return this.http.get<KbHubIndexResponse>(`${this.API_URL}/hub/index`);
  }

  searchHub(query: string, limit = 7): Observable<KbHubSearchResult[]> {
    return this.http.get<KbHubSearchResult[]>(`${this.API_URL}/hub/search`, {
      params: { q: query, limit: String(limit) }
    });
  }

  createArticle(payload: KbArticleCreateRequest): Observable<KbArticle> {
    return this.http.post<KbArticle>(`${this.API_URL}/articles`, payload);
  }

  updateArticle(id: number, payload: KbArticleCreateRequest): Observable<KbArticle> {
    return this.http.put<KbArticle>(`${this.API_URL}/articles/${id}`, payload);
  }

  setArticleActive(id: number, value: boolean): Observable<KbArticle> {
    return this.http.patch<KbArticle>(`${this.API_URL}/articles/${id}/active?value=${value}`, {});
  }

  deleteArticle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/articles/${id}`);
  }

  duplicateArticle(id: number): Observable<KbArticle> {
    return this.http.post<KbArticle>(`${this.API_URL}/articles/${id}/duplicate`, {});
  }

  getArticleMap(articleId: number): Observable<KbArticleMap> {
    return this.http.get<KbArticleMap>(`${this.KB_MAP_URL}/article/${articleId}`);
  }

  saveArticleMap(articleId: number, payload: KbMapSavePayload): Observable<KbMapSaveResponse> {
    const urls = [
      `${this.KB_MAP_URL}/article/${articleId}/save`,
      `${this.KB_MAP_URL}/articles/${articleId}/save`,
      `${this.KB_MAP_URL}/${articleId}/save`,
      `${this.KB_MAP_URL}/article/${articleId}`
    ];

    const runAttempt = (index: number): Observable<KbMapSaveResponse> => {
      const url = urls[index];
      return this.http.post<KbMapSaveResponse>(url, payload).pipe(
        catchError((err: HttpErrorResponse) => {
          const shouldRetry = (err.status === 404 || err.status === 405) && index < urls.length - 1;
          if (shouldRetry) {
            return runAttempt(index + 1);
          }

          const wrapped = {
            ...err,
            message: `${err.message} (POST ${url})`
          } as HttpErrorResponse;
          return throwError(() => wrapped);
        })
      );
    };

    return runAttempt(0);
  }

  trackArticleTime(payload: KbTrackArticleTimeRequest): Observable<{ success?: boolean }> {
    return this.http.post<{ success?: boolean }>(`${this.KB_ANALYTICS_URL}/track-time`, payload);
  }

  submitArticleFeedback(articleId: number, payload: KbArticleFeedbackRequest): Observable<{ success?: boolean; message?: string }> {
    const urls = [
      `${this.API_URL}/articles/${articleId}/feedback`,
      `/api/astra/kb/articles/${articleId}/feedback`
    ];

    const runAttempt = (index: number): Observable<{ success?: boolean; message?: string }> => {
      const url = urls[index];
      return this.http.post<{ success?: boolean; message?: string }>(url, payload).pipe(
        catchError((err: HttpErrorResponse) => {
          const shouldRetry = (err.status === 404 || err.status === 405) && index < urls.length - 1;
          if (shouldRetry) {
            return runAttempt(index + 1);
          }

          const wrapped = {
            ...err,
            message: `${err.message} (POST ${url})`
          } as HttpErrorResponse;
          return throwError(() => wrapped);
        })
      );
    };

    return runAttempt(0);
  }

  getAnalyticsDashboard(days = 30): Observable<KbAnalyticsDashboard> {
    return this.http.get<KbAnalyticsDashboard>(`${this.KB_ANALYTICS_URL}/dashboard?days=${days}`);
  }
}

