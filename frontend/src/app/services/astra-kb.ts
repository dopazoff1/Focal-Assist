import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AstraCategory {
  id: number;
  name: string;
  displayOrder: number;
}

export interface AstraArticleSummary {
  id: number;
  title: string;
  displayOrder: number;
  categoryId: number;
  categoryName: string;
}

export interface AstraArticleDetails {
  id: number;
  title: string;
  content: string;
  displayOrder: number;
  categoryId: number;
  categoryName: string;
}

export interface AstraFeedback {
  id: number;
  articleId: number;
  articleTitle: string;
  sentiment: 'LIKE' | 'DISLIKE' | string;
  feedbackText: string;
  viewerName: string;
  viewerEmail: string;
  createdAt: string;
}

export interface AstraTicket {
  id: number;
  ticketKey: string;
  articleId: number | null;
  articleTitle: string;
  requesterName: string;
  requesterEmail: string;
  requesterCompany: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assigneeUserId: number | null;
  assigneeName: string;
  internalNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface AstraLlmIntegration {
  id: number;
  providerCode: string;
  providerName: string;
  enabled: boolean;
  endpointUrl: string;
  modelName: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AstraDashboardData {
  periodDays: number;
  generatedAt: string;
  totals: {
    views: number;
    uniqueViewers: number;
    feedbackCount: number;
    likes: number;
    dislikes: number;
    publicTickets: number;
    openTickets: number;
    pendingTickets: number;
    solvedTickets: number;
    closedTickets: number;
  };
  topArticles: Array<{
    articleId: number;
    title: string;
    category: string;
    views: number;
    likes: number;
    dislikes: number;
    lastViewedAt: string;
  }>;
  recentFeedback: AstraFeedback[];
  recentViewers: Array<{
    viewer: string;
    email: string;
    source: string;
    viewedAt: string;
    articleId: number;
    articleTitle: string;
  }>;
  tickets: AstraTicket[];
  llmIntegrations: AstraLlmIntegration[];
}

@Injectable({ providedIn: 'root' })
export class AstraKbService {
  private readonly internalApi = '/api/astra/kb';
  private readonly publicApi = '/api/public/astra/kb';

  constructor(private http: HttpClient) {}

  getDashboard(days = 30): Observable<AstraDashboardData> {
    return this.http.get<AstraDashboardData>(`${this.internalApi}/dashboard?days=${days}`);
  }

  listCategories(): Observable<AstraCategory[]> {
    return this.http.get<AstraCategory[]>(`${this.internalApi}/categories`);
  }

  listArticlesByCategory(categoryId: number): Observable<AstraArticleSummary[]> {
    return this.http.get<AstraArticleSummary[]>(`${this.internalApi}/categories/${categoryId}/articles`);
  }

  getArticle(articleId: number): Observable<AstraArticleDetails> {
    return this.http.get<AstraArticleDetails>(`${this.internalApi}/articles/${articleId}`);
  }

  trackView(articleId: number, payload: { sessionId?: string; source?: string; viewerName?: string; viewerEmail?: string } = {}): Observable<any> {
    return this.http.post(`${this.internalApi}/articles/${articleId}/view`, payload || {});
  }

  submitFeedback(articleId: number, payload: { sentiment: 'LIKE' | 'DISLIKE' | string; feedbackText?: string; viewerName?: string; viewerEmail?: string }): Observable<any> {
    return this.http.post(`${this.internalApi}/articles/${articleId}/feedback`, payload);
  }

  listFeedback(articleId: number, limit = 40): Observable<AstraFeedback[]> {
    return this.http.get<AstraFeedback[]>(`${this.internalApi}/articles/${articleId}/feedback?limit=${limit}`);
  }

  listTickets(): Observable<AstraTicket[]> {
    return this.http.get<AstraTicket[]>(`${this.internalApi}/tickets`);
  }

  updateTicket(ticketId: number, payload: { status?: string; assigneeUserId?: number | null; assigneeName?: string; internalNote?: string }): Observable<any> {
    return this.http.put(`${this.internalApi}/tickets/${ticketId}`, payload || {});
  }

  listLlmIntegrations(): Observable<AstraLlmIntegration[]> {
    return this.http.get<AstraLlmIntegration[]>(`${this.internalApi}/llm/integrations`);
  }

  updateLlmIntegration(
    providerCode: string,
    payload: { enabled?: boolean; providerName?: string; endpointUrl?: string; modelName?: string; apiKey?: string; notes?: string }
  ): Observable<any> {
    return this.http.put(`${this.internalApi}/llm/integrations/${providerCode}`, payload || {});
  }

  listPublicCategories(): Observable<AstraCategory[]> {
    return this.http.get<AstraCategory[]>(`${this.publicApi}/categories`);
  }

  listPublicArticlesByCategory(categoryId: number): Observable<AstraArticleSummary[]> {
    return this.http.get<AstraArticleSummary[]>(`${this.publicApi}/categories/${categoryId}/articles`);
  }

  getPublicArticle(articleId: number): Observable<AstraArticleDetails> {
    return this.http.get<AstraArticleDetails>(`${this.publicApi}/articles/${articleId}`);
  }

  trackPublicView(articleId: number, payload: { sessionId?: string; source?: string; viewerName?: string; viewerEmail?: string } = {}): Observable<any> {
    return this.http.post(`${this.publicApi}/articles/${articleId}/view`, payload || {});
  }

  submitPublicFeedback(articleId: number, payload: { sentiment: 'LIKE' | 'DISLIKE' | string; feedbackText?: string; viewerName?: string; viewerEmail?: string }): Observable<any> {
    return this.http.post(`${this.publicApi}/articles/${articleId}/feedback`, payload);
  }

  createPublicTicket(payload: {
    articleId?: number | null;
    requesterName: string;
    requesterEmail: string;
    requesterCompany?: string;
    subject: string;
    description: string;
    priority?: string;
  }): Observable<any> {
    return this.http.post(`${this.publicApi}/tickets`, payload);
  }
}

