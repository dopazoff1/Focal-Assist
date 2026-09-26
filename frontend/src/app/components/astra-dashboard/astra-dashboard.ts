import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AstraDashboardData, AstraKbService } from '../../services/astra-kb';

@Component({
  selector: 'app-astra-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './astra-dashboard.html',
  styleUrls: ['./astra-dashboard.css']
})
export class AstraDashboardComponent implements OnInit {
  loading = false;
  error = '';
  days = 30;
  data?: AstraDashboardData;

  constructor(private astra: AstraKbService) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = '';
    this.astra.getDashboard(this.days).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'Could not load Astra dashboard data.';
      }
    });
  }

  maxViews(): number {
    const values = (this.data?.topArticles || []).map(item => Number(item.views || 0));
    const max = values.length ? Math.max(...values) : 0;
    return max > 0 ? max : 1;
  }

  viewRatio(views: number): number {
    return (views / this.maxViews()) * 100;
  }
}

