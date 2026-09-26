import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { PageService, Page, Choice } from '../../services/page';
import { AuthService } from '../../services/auth';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-magic-assistance',
  templateUrl: './magic-assistance.html',
  styleUrls: ['./magic-assistance.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class MagicAssistance implements OnInit, OnDestroy {
  @ViewChild('magicCard') magicCard?: ElementRef<HTMLElement>;

  private readonly homePlaceholder: Page = {
    id: 0,
    name: 'MAGIC ASSISTANCE HOME',
    content: '<p>Select the issue the customer is facing.</p>',
    isStart: true,
    choices: []
  };

  page: Page = { ...this.homePlaceholder };
  loading = true;
  private pageHistory: number[] = [];
  private swapAnimFrame?: number;
  private routerEventsSub?: Subscription;

  roleStartPageMap: { [role: number]: number } = {
    1: 1,
    2: 5,
    3: 10
  };

  constructor(
    private pageService: PageService,
    private authService: AuthService,
    private location: Location,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.page = { ...this.homePlaceholder };
    this.loading = true;
    this.loadStartPage();

    // Reload start page on route navigation (even same path)
    this.routerEventsSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.loadStartPage();
      });
  }

  ngOnDestroy(): void {
    this.routerEventsSub?.unsubscribe();
    if (this.swapAnimFrame !== undefined && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.swapAnimFrame);
      this.swapAnimFrame = undefined;
    }
  }

  private loadStartPage() {
    // Reset visual state first to avoid flashing terminal message while API resolves.
    this.page = { ...this.homePlaceholder };
    this.loading = true;

    const role = this.authService.getUserRole();
    const preferredStartPageId = role ? this.roleStartPageMap[role] : undefined;

    // Resolve a valid start page from DB first to avoid noisy 404 requests for stale hard-coded IDs.
    this.pageService.getAllPages().subscribe({
      next: response => {
        const pages = Array.isArray(response) ? response : (response?.pages || []);
        if (!pages.length) {
          this.page = { ...this.homePlaceholder };
          this.loading = false;
          return;
        }

        const preferredStart = preferredStartPageId
          ? pages.find(pg => pg.id === preferredStartPageId)
          : undefined;
        const startPage = preferredStart || pages.find(pg => !!pg.isStart) || pages[0];
        this.loadPage(startPage.id, false);
      },
      error: () => {
        // Fallback to legacy role mapping if page listing endpoint fails.
        this.loadPage(preferredStartPageId || 1, true);
      }
    });
  }

  loadPage(pageId: number, isStartLoad = false, addToHistory = false, animateSwap = false) {
    if (addToHistory && this.page.id) {
      this.pageHistory.push(this.page.id);
    }

    this.loading = true;
    this.pageService.getPage(pageId).subscribe({
      next: p => {
        this.page = p;
        this.loading = false;
        this.cdr.detectChanges(); // ensure template updates immediately
        if (animateSwap) {
          this.playStepTransition();
        }
      },
      error: () => {
        // If configured start page id no longer exists, fallback to real start page from DB.
        if (!isStartLoad) {
          this.loading = false;
          return;
        }

        this.pageService.getAllPages().subscribe({
          next: response => {
            const pages = Array.isArray(response) ? response : (response?.pages || []);
            if (!pages.length) {
              this.page = { ...this.homePlaceholder };
              this.loading = false;
              return;
            }

            const startPage = pages.find(pg => !!pg.isStart) || pages[0];
            this.loadPage(startPage.id, false, false);
          },
          error: () => {
            this.page = { ...this.homePlaceholder };
            this.loading = false;
          }
        });
      }
    });
  }

  get pageContent(): string {
    const content = (this.page.content || '').toString().trim();
    if (content) return content;
    return this.homePlaceholder.content || '';
  }

  get hasChoices(): boolean {
    return this.pageChoices.length > 0;
  }

  get pageChoices(): Choice[] {
    return this.page.choices ?? [];
  }

  goBack() {
    const previousPageId = this.pageHistory.pop();
    if (previousPageId) {
      this.loadPage(previousPageId, false, false, true);
      return;
    }

    if (this.page.prevPageId) {
      this.loadPage(this.page.prevPageId, false, false, true);
    } else {
      this.location.back();
    }
  }

  selectChoice(choice: Choice) {
    this.loadPage(choice.targetPageId, false, true, true);
  }

  private playStepTransition(): void {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (this.swapAnimFrame !== undefined) {
      window.cancelAnimationFrame(this.swapAnimFrame);
      this.swapAnimFrame = undefined;
    }

    this.swapAnimFrame = window.requestAnimationFrame(() => {
      this.swapAnimFrame = undefined;
      const card = this.magicCard?.nativeElement;
      if (!card || typeof card.animate !== 'function') return;

      card.animate(
        [
          { opacity: 0.9, transform: 'translateX(4px)' },
          { opacity: 1, transform: 'none' }
        ],
        {
          duration: 180,
          easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
          fill: 'none'
        }
      );
    });
  }
}
