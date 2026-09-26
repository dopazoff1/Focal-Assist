import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Choice {
  id: number;
  label: string;
  targetPageId: number;
  displayOrder?: number;
}

export interface Page {
  id: number;
  name: string;
  content: string;
  tag?: string;
  prevPageId?: number;
  isStart?: boolean;
  choices?: Choice[];
}

export interface TreeChoiceSavePayload {
  id: number | null;
  label: string;
  targetPageId: number;
  displayOrder?: number;
}

export interface TreePageSavePayload {
  id: number | null;
  name: string;
  content: string;
  tag?: string;
  prevPageId?: number | null;
  isStart?: boolean;
  choices?: TreeChoiceSavePayload[];
}

export interface TreeSaveResponse {
  success: boolean;
  savedPages: number;
  idMap?: Record<string, number>;
  savedPageIds?: number[];
}

@Injectable({
  providedIn: 'root'
})
export class PageService {
  private apiUrl = '/api/pages';

  constructor(private http: HttpClient) {}

  getPage(pageId: number): Observable<Page> {
    return this.http.get<Page>(`${this.apiUrl}/${pageId}`);
  }

  getAllPages(): Observable<Page[] | { pages: Page[] }> {
    return this.http.get<Page[] | { pages: Page[] }>(this.apiUrl);
  }

  saveTree(pages: TreePageSavePayload[]): Observable<TreeSaveResponse> {
    return this.http.post<TreeSaveResponse>(`${this.apiUrl}/tree/save`, { pages });
  }
}

