import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

export interface CaseTagNode {
  id: number;
  label: string;
  content?: string;
  xPos?: number;
  yPos?: number;
  isStart?: boolean;
}

export interface CaseTagEdge {
  id: number;
  sourceNodeId: number;
  targetNodeId: number;
  label: string;
  displayOrder?: number;
}

export interface CaseTagMap {
  nodes: CaseTagNode[];
  edges: CaseTagEdge[];
}

export interface CaseTagMapSavePayload {
  nodes: CaseTagNode[];
  edges: CaseTagEdge[];
}

export interface CaseTagMapSaveResponse {
  success?: boolean;
  message?: string;
  savedNodes?: number;
  savedEdges?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CaseTagsService {
  private readonly API_URL = '/api/case-tags';

  constructor(private http: HttpClient) {}

  getMap(): Observable<CaseTagMap> {
    return this.http.get<CaseTagMap>(`${this.API_URL}/map`);
  }

  saveMap(payload: CaseTagMapSavePayload): Observable<CaseTagMapSaveResponse> {
    const urls = [
      `${this.API_URL}/map/save`,
      `${this.API_URL}/map`
    ];

    const runAttempt = (index: number): Observable<CaseTagMapSaveResponse> => {
      const url = urls[index];
      return this.http.post<CaseTagMapSaveResponse>(url, payload).pipe(
        catchError((err: HttpErrorResponse) => {
          const shouldRetry = (err.status === 404 || err.status === 405) && index < urls.length - 1;
          if (shouldRetry) {
            return runAttempt(index + 1);
          }
          return throwError(() => err);
        })
      );
    };

    return runAttempt(0);
  }
}

