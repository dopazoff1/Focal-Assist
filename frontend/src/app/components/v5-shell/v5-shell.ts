import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-v5-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './v5-shell.html',
  styleUrls: ['./v5-shell.css']
})
export class V5ShellComponent implements OnInit, OnDestroy {
  quickSearch = '';
  @ViewChild('routeHost') routeHost?: ElementRef<HTMLElement>;

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('v2-mode');
      document.body.classList.remove('v3-mode');
      document.body.classList.remove('v4-mode');
      document.body.classList.remove('login-v3-mode');
      document.body.classList.remove('login-v4-mode');
      document.body.classList.remove('login-v5-mode');
      document.body.classList.add('v5-mode');
      document.documentElement.classList.remove('ui-scale-compact');
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('v5-mode');
    }
  }

  logout(): void {
    this.auth.logout();
  }

  runQuickSearch(event?: Event): void {
    event?.preventDefault();
    const q = (this.quickSearch || '').trim();
    if (!q) return;
    void this.router.navigate(['/v5/contacts'], { queryParams: { q } });
  }

  onRouteActivate(): void {
    if (typeof window === 'undefined') return;
    const host = this.routeHost?.nativeElement;
    if (!host) return;
    const target = Array.from(host.children).find(
      (el): el is HTMLElement => el instanceof HTMLElement && el.tagName !== 'ROUTER-OUTLET'
    );
    if (!target || typeof target.animate !== 'function') return;
    target.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 260,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'both'
      }
    );
  }
}


