import { Injectable } from '@angular/core';

export interface AkinatorGuess {
  name?: string;
  description?: string;
  image?: string;
}

export interface AkinatorState {
  sessionId: string;
  question: string;
  answers: string[];
  progress: number;
  guess?: AkinatorGuess;
}

@Injectable({ providedIn: 'root' })
export class AkinatorClientService {
  private readonly endpoint = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api/akinator'
    : 'http://localhost:4201/api/akinator';

  async start(): Promise<AkinatorState> {
    return this.request('', { method: 'POST', body: JSON.stringify({ region: 'en' }) });
  }

  async answer(sessionId: string, answer: number): Promise<AkinatorState> {
    return this.request(`/${encodeURIComponent(sessionId)}/answer`, { method: 'POST', body: JSON.stringify({ answer }) });
  }

  async back(sessionId: string): Promise<AkinatorState> {
    return this.request(`/${encodeURIComponent(sessionId)}/back`, { method: 'POST' });
  }

  async close(sessionId: string): Promise<void> {
    await fetch(`${this.endpoint}/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).catch(() => undefined);
  }

  private async request(path: string, init: RequestInit): Promise<AkinatorState> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
      });
      if (!response.ok) throw new Error((await response.text()) || `Akinator request failed (${response.status})`);
      return response.json() as Promise<AkinatorState>;
    } finally {
      clearTimeout(timeout);
    }
  }
}
