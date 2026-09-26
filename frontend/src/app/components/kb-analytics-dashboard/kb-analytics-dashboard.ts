import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  KbAnalyticsAgentRow,
  KbAnalyticsArticleAgentRow,
  KbAnalyticsArticleRow,
  KbAnalyticsDashboard,
  KbService
} from '../../services/kb';

type PeriodPreset = '7d' | '30d' | '90d' | 'custom';

@Component({
  selector: 'app-kb-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kb-analytics-dashboard.html',
  styleUrls: ['./kb-analytics-dashboard.css']
})
export class KbAnalyticsDashboardComponent implements OnInit {
  periodPreset: PeriodPreset = '30d';
  customStart = '';
  customEnd = '';

  loading = false;
  error = '';

  dashboard: KbAnalyticsDashboard | null = null;
  articles: KbAnalyticsArticleRow[] = [];
  agents: KbAnalyticsAgentRow[] = [];
  recent: KbAnalyticsDashboard['recent'] = [];
  articleAgents: KbAnalyticsArticleAgentRow[] = [];

  selectedArticleId: number | null = null;

  constructor(private kbService: KbService) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    const days = this.resolveDays();
    if (!days) return;

    this.error = '';
    this.loading = true;
    this.kbService.getAnalyticsDashboard(days).subscribe({
      next: data => {
        this.dashboard = data;
        this.articles = Array.isArray(data?.articles) ? data.articles : [];
        this.agents = Array.isArray(data?.agents) ? data.agents : [];
        this.recent = Array.isArray(data?.recent) ? data.recent : [];
        this.articleAgents = Array.isArray(data?.articleAgents) ? data.articleAgents : [];
        if (!this.selectedArticleId || !this.articles.some(a => a.articleId === this.selectedArticleId)) {
          this.selectedArticleId = this.articles[0]?.articleId ?? null;
        }
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.dashboard = null;
        this.articles = [];
        this.agents = [];
        this.recent = [];
        this.articleAgents = [];
        this.selectedArticleId = null;
        this.error = err?.error?.message || 'Failed to load knowledge analytics.';
      }
    });
  }

  onPresetChange(): void {
    if (this.periodPreset === 'custom') {
      return;
    }
    this.reload();
  }

  selectArticle(articleId: number): void {
    this.selectedArticleId = articleId;
  }

  get selectedArticle(): KbAnalyticsArticleRow | null {
    if (!this.selectedArticleId) return null;
    return this.articles.find(a => a.articleId === this.selectedArticleId) || null;
  }

  get selectedArticleAgentRows(): KbAnalyticsArticleAgentRow[] {
    if (!this.selectedArticleId) return [];
    return this.articleAgents
      .filter(row => row.articleId === this.selectedArticleId)
      .sort((a, b) => b.seconds - a.seconds);
  }

  get totalHours(): number {
    return Number(this.dashboard?.totals?.totalHours || 0);
  }

  get uniqueUsers(): number {
    return Number(this.dashboard?.totals?.uniqueUsers || 0);
  }

  get uniqueArticles(): number {
    return Number(this.dashboard?.totals?.uniqueArticles || 0);
  }

  get trackedEvents(): number {
    return Number(this.dashboard?.totals?.trackedEvents || 0);
  }

  get avgMinutesPerArticle(): number {
    return Number(this.dashboard?.totals?.avgMinutesPerArticle || 0);
  }

  get avgMinutesPerUser(): number {
    return Number(this.dashboard?.totals?.avgMinutesPerUser || 0);
  }

  articleBarPercent(seconds: number): number {
    const max = this.articles[0]?.totalSeconds || 0;
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (seconds / max) * 100));
  }

  agentBarPercent(seconds: number): number {
    const max = this.agents[0]?.totalSeconds || 0;
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (seconds / max) * 100));
  }

  formatMinutes(value: number): string {
    const mins = Math.max(0, Math.round(value || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }

  formatSeconds(value: number): string {
    return this.formatMinutes((value || 0) / 60);
  }

  private resolveDays(): number | null {
    if (this.periodPreset === '7d') return 7;
    if (this.periodPreset === '30d') return 30;
    if (this.periodPreset === '90d') return 90;

    const start = this.customStart ? new Date(`${this.customStart}T00:00:00`) : null;
    const end = this.customEnd ? new Date(`${this.customEnd}T23:59:59`) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      this.error = 'Pick a valid custom date range.';
      return null;
    }
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.ceil(diffMs / 86400000));
    return Math.min(365, days);
  }
}
