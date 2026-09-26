import { AfterViewInit, Directive, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

let mermaidBlockId = 0;

@Directive({
  selector: '[appMermaidContent]',
  standalone: true
})
export class MermaidContentDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() mermaidContent = '';

  private observer?: MutationObserver;
  private viewReady = false;
  private renderTimer?: ReturnType<typeof setTimeout>;
  private renderVersion = 0;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (typeof MutationObserver !== 'undefined') {
      this.observer = new MutationObserver(() => this.scheduleRender());
      this.observer.observe(this.host.nativeElement, { childList: true, subtree: true });
    }
    this.scheduleRender();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.viewReady && changes['mermaidContent']) {
      this.restoreRenderedBlocks();
      this.scheduleRender();
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.renderTimer) clearTimeout(this.renderTimer);
  }

  private scheduleRender(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => void this.renderBlocks(), 120);
  }

  private async renderBlocks(): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const blocks = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.mermaid:not([data-mermaid-rendered])'));
    if (!blocks.length) return;

    const version = ++this.renderVersion;
    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: {
          primaryColor: '#eaf6ff',
          primaryTextColor: '#132238',
          primaryBorderColor: '#0098ff',
          lineColor: '#52657d',
          secondaryColor: '#f8fbff',
          tertiaryColor: '#ffffff'
        }
      });

      for (const block of blocks) {
        const source = (block.textContent || '').trim();
        if (!source || version !== this.renderVersion) continue;

        try {
          const result = await mermaid.render(`focal-mermaid-${++mermaidBlockId}`, source);
          if (!block.isConnected || version !== this.renderVersion) return;
          block.innerHTML = result.svg;
          block.dataset['mermaidSource'] = source;
          block.dataset['mermaidRendered'] = 'true';
          block.removeAttribute('aria-label');
        } catch (error) {
          block.dataset['mermaidRendered'] = 'true';
          block.classList.add('mermaid-error');
          block.setAttribute('role', 'alert');
          block.textContent = `Flowchart error: ${error instanceof Error ? error.message : 'invalid Mermaid syntax'}`;
        }
      }
    } catch {
      // The editor remains usable as source text if the optional renderer fails to load.
    }
  }

  private restoreRenderedBlocks(): void {
    const rendered = this.host.nativeElement.querySelectorAll<HTMLElement>('.mermaid[data-mermaid-rendered]');
    for (const block of rendered) {
      const source = block.dataset['mermaidSource'];
      if (!source) continue;
      block.textContent = source;
      block.removeAttribute('data-mermaid-source');
      block.removeAttribute('data-mermaid-rendered');
      block.classList.remove('mermaid-error');
      block.removeAttribute('role');
    }
  }
}
