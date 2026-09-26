import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-astra-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './astra-shell.html',
  styleUrls: ['./astra-shell.css']
})
export class AstraShellComponent implements OnInit, OnDestroy {
  quickSearch = '';
  pageTitle = 'Astra Dashboard';
  pageSubtitle = 'Knowledge Intelligence';
  sidebarOpen = false;
  private sub?: Subscription;

  constructor(public auth: AuthService, private router: Router) {}

  get canManageIntegrations(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS', 'OPS');
  }

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.add('astra-mode');
    }
    this.updateTitle(this.router.url);
    this.sub = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.sidebarOpen = false;
        this.updateTitle(event.urlAfterRedirects || event.url);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('astra-mode');
    }
  }

  logout(): void {
    this.auth.logout();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  runQuickSearch(event?: Event): void {
    event?.preventDefault();
    const q = (this.quickSearch || '').trim();
    void this.router.navigate(['/astra/knowledge'], {
      queryParams: q ? { q } : {},
      queryParamsHandling: q ? 'merge' : undefined
    });
  }

  private updateTitle(url: string): void {
    const path = (url || '').split('?')[0];
    if (path.includes('/astra/knowledge')) {
      this.pageTitle = 'Astra Knowledge Base';
      this.pageSubtitle = 'Content + SOP + Insights';
      return;
    }
    if (path.includes('/astra/tickets')) {
      this.pageTitle = 'Astra Public Tickets';
      this.pageSubtitle = 'Support Queue';
      return;
    }
    if (path.includes('/astra/integrations')) {
      this.pageTitle = 'Astra LLM Integrations';
      this.pageSubtitle = 'AI Stack Orchestration';
      return;
    }
    if (path.includes('/astra/public')) {
      this.pageTitle = 'Astra Public Help Center';
      this.pageSubtitle = 'Customer Self-Service';
      return;
    }
    this.pageTitle = 'Astra Dashboard';
    this.pageSubtitle = 'Knowledge Intelligence';
  }
}
