import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import type { LoginV2SceneController } from './login-v2-scene-renderer';

@Component({
  selector: 'focal-login-v2-scene',
  standalone: true,
  template: '<canvas #canvas aria-hidden="true" data-animation-active="false"></canvas>',
  styles: [`
    :host { position: absolute; inset: 0; display: block; pointer-events: none; }
    canvas { display: block; width: 100%; height: 100%; opacity: 0; }
    canvas[data-ready="true"] { opacity: 1; }
  `]
})
export class LoginV2Scene implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private destroyed = false;
  private cleanup?: LoginV2SceneController;
  private pendingExit?: () => void;
  private pendingExitTimer?: number;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.zone.runOutsideAngular(async () => {
      try {
        const { createLoginV2Scene } = await import('./login-v2-scene-renderer');
        if (!this.destroyed) {
          this.cleanup = createLoginV2Scene(this.canvas.nativeElement);
          const pendingExit = this.pendingExit;
          this.pendingExit = undefined;
          if (pendingExit) {
            if (this.pendingExitTimer !== undefined) window.clearTimeout(this.pendingExitTimer);
            this.pendingExitTimer = undefined;
            this.cleanup.playExit(pendingExit);
          }
        }
      } catch {
        const pendingExit = this.pendingExit;
        this.pendingExit = undefined;
        if (pendingExit) pendingExit();
      }
    });
  }

  playExit(onComplete: () => void): void {
    if (this.destroyed) {
      onComplete();
      return;
    }
    if (this.cleanup) {
      this.cleanup.playExit(onComplete);
    } else {
      this.pendingExit = onComplete;
      this.pendingExitTimer = window.setTimeout(() => {
        const pendingExit = this.pendingExit;
        this.pendingExit = undefined;
        this.pendingExitTimer = undefined;
        if (pendingExit) pendingExit();
      }, 980);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.pendingExitTimer !== undefined && typeof window !== 'undefined') window.clearTimeout(this.pendingExitTimer);
    const pendingExit = this.pendingExit;
    this.pendingExit = undefined;
    if (pendingExit) pendingExit();
    this.cleanup?.();
  }
}
