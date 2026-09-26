import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type TrainingAssetKind = 'VIDEO';

export interface TrainingAssetMeta {
  id: string;
  kind: TrainingAssetKind;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class TrainingAssetService {
  private readonly apiUrl = '/api/training-assets';

  constructor(private http: HttpClient) {}

  async saveVideo(file: File): Promise<TrainingAssetMeta> {
    if (!file) {
      throw new Error('No file selected.');
    }
    const formData = new FormData();
    formData.append('file', file, (file.name || 'video').toString());
    const response = await firstValueFrom(
      this.http.post<Partial<TrainingAssetMeta>>(`${this.apiUrl}/videos`, formData)
    );
    return this.normalizeMeta(response);
  }

  async getMeta(id: string): Promise<TrainingAssetMeta | null> {
    const key = (id || '').toString().trim();
    if (!key) return null;
    try {
      const response = await firstValueFrom(
        this.http.get<Partial<TrainingAssetMeta>>(`${this.apiUrl}/videos/${encodeURIComponent(key)}/meta`)
      );
      return this.normalizeMeta(response);
    } catch (error: unknown) {
      const httpError = error as HttpErrorResponse;
      if (httpError?.status === 404) return null;
      throw error;
    }
  }

  async getBlob(id: string): Promise<Blob | null> {
    const key = (id || '').toString().trim();
    if (!key) return null;
    try {
      return await firstValueFrom(
        this.http.get(`${this.apiUrl}/videos/${encodeURIComponent(key)}`, { responseType: 'blob' })
      );
    } catch (error: unknown) {
      const httpError = error as HttpErrorResponse;
      if (httpError?.status === 404) return null;
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const key = (id || '').toString().trim();
    if (!key) return;
    try {
      await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/videos/${encodeURIComponent(key)}`));
    } catch (error: unknown) {
      const httpError = error as HttpErrorResponse;
      if (httpError?.status === 404) return;
      throw error;
    }
  }

  private normalizeMeta(input: Partial<TrainingAssetMeta> | null | undefined): TrainingAssetMeta {
    const id = (input?.id || '').toString().trim();
    if (!id) {
      throw new Error('Invalid training asset response: missing id.');
    }
    return {
      id,
      kind: 'VIDEO',
      filename: (input?.filename || 'video').toString(),
      mimeType: (input?.mimeType || 'application/octet-stream').toString(),
      size: Number(input?.size || 0),
      createdAt: (input?.createdAt || new Date().toISOString()).toString()
    };
  }
}
