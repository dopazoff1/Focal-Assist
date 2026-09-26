import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy } from '@angular/core';

/** Gate CSS loops at the workspace owner, including dynamically inserted loaders. */
@Directive({ selector: '[focalVisibleMotion]', standalone: true })
export class VisibleMotion implements AfterViewInit, OnDestroy {
  private intersection?: IntersectionObserver;
  private mutations?: MutationObserver;
  private targets = new Map<Element, boolean>();
  private readonly selector = '.spinner, .button-spinner, .kb-spinner, .magic-spinner, .magic-dot, .magic-waiting-spinner, .magic-loading-dots span, .thinking-dots .dot, .loading-dot, .loading-card span, .typing-dots span, .typing-dots i, .typing span, .assistant-typing span, .assistant-loading-dots span, .skeleton, .skeleton-row';
  private readonly visibility = () => {
    this.targets.forEach((inView, element) => element.classList.toggle('focal-motion-paused', document.hidden || !inView));
  };

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      this.intersection = new IntersectionObserver(entries => {
        entries.forEach(entry => this.targets.set(entry.target, entry.isIntersecting));
        this.visibility();
      });
      const update = () => {
        this.targets.forEach((_, element) => {
          if (!this.host.nativeElement.contains(element)) {
            this.intersection?.unobserve(element);
            this.targets.delete(element);
          }
        });
        this.host.nativeElement.querySelectorAll(this.selector).forEach(element => {
          if (this.targets.has(element)) return;
          this.targets.set(element, false);
          element.classList.add('focal-motion-paused');
          this.intersection?.observe(element);
        });
      };
      this.mutations = new MutationObserver(update);
      this.mutations.observe(this.host.nativeElement, { subtree: true, childList: true });
      document.addEventListener('visibilitychange', this.visibility);
      update();
    });
  }

  ngOnDestroy(): void {
    this.intersection?.disconnect();
    this.mutations?.disconnect();
    this.targets.clear();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibility);
  }
}
