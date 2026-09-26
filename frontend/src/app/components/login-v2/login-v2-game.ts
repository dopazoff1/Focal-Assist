import { AfterViewInit, Component, ElementRef, EventEmitter, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { LucideArrowLeft, LucideCarFront, LucideChevronRight, LucideRocket, LucideSparkles, LucideTrainFront, LucideX } from '@lucide/angular';
import { AkinatorClientService, AkinatorGuess, AkinatorState } from './akinator-client.service';
import type { LoginV2GameController } from './login-v2-game-renderer';

export type GameId = 'cars' | 'subway' | 'spaceship' | 'akinator';

@Component({
  selector: 'focal-login-v2-game',
  standalone: true,
  templateUrl: './login-v2-game.html',
  styleUrls: ['./login-v2-game.css'],
  imports: [NgFor, NgIf, LucideArrowLeft, LucideCarFront, LucideChevronRight, LucideRocket, LucideSparkles, LucideTrainFront, LucideX]
})
export class LoginV2Game implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  @Output() closed = new EventEmitter<void>();
  selectedGame: GameId | null = null;
  score = 0;
  best = 0;
  akinatorQuestion = '';
  akinatorAnswers: string[] = [];
  akinatorProgress = 0;
  akinatorGuess?: AkinatorGuess;
  akinatorBusy = false;
  akinatorError = '';
  akinatorOffline = false;
  fallbackStep = 0;
  private closing = false;
  private cleanup?: LoginV2GameController;
  akinatorSession = '';
  private renderGeneration = 0;
  private readonly fallbackQuestions = [
    'Is your character connected to the Focal network?',
    'Would your character be found in a city?',
    'Does your character move fast?',
    'Is your character usually surrounded by people?',
    'Does your character feel at home after dark?'
  ];
  private readonly fallbackAnswers = ['Yes', 'No', "Don't know", 'Probably', 'Probably not'];

  constructor(private zone: NgZone, private akinator: AkinatorClientService) {}

  ngAfterViewInit(): void {}

  close(): void {
    if (this.closing) return;
    this.closing = true;
    if (this.cleanup) this.cleanup.playExit(() => this.zone.run(() => this.closed.emit()));
    else this.closed.emit();
  }

  launchGame(game: GameId): void {
    this.destroyRenderer();
    this.selectedGame = game;
    this.score = 0;
    if (game === 'akinator') {
      void this.startAkinator();
      return;
    }
    const generation = ++this.renderGeneration;
    setTimeout(() => this.startRenderer(game, generation));
  }

  backToMenu(): void {
    this.renderGeneration++;
    this.destroyRenderer();
    if (this.akinatorSession) void this.akinator.close(this.akinatorSession);
    this.akinatorSession = '';
    this.selectedGame = null;
    this.akinatorGuess = undefined;
    this.akinatorError = '';
    this.akinatorBusy = false;
  }

  async answerAkinator(answer: number): Promise<void> {
    if (this.akinatorBusy || this.akinatorGuess) return;
    this.akinatorBusy = true;
    this.akinatorError = '';
    if (this.akinatorOffline) {
      this.fallbackStep++;
      this.akinatorProgress = Math.min(94, Math.round((this.fallbackStep / this.fallbackQuestions.length) * 94));
      if (this.fallbackStep >= this.fallbackQuestions.length) {
        this.akinatorGuess = { name: 'A Focal signal runner', description: 'A local pattern match from the district network.' };
        this.akinatorQuestion = '';
      } else {
        this.akinatorQuestion = this.fallbackQuestions[this.fallbackStep];
      }
      this.akinatorBusy = false;
      return;
    }
    try {
      const state = await this.akinator.answer(this.akinatorSession, answer);
      this.zone.run(() => this.applyAkinatorState(state));
    } catch (error) {
      this.zone.run(() => { this.akinatorError = error instanceof Error ? error.message : 'The Akinator link dropped.'; });
    } finally {
      this.zone.run(() => { this.akinatorBusy = false; });
    }
  }

  async backAkinator(): Promise<void> {
    if (this.akinatorBusy || this.akinatorOffline || !this.akinatorSession) return;
    this.akinatorBusy = true;
    try {
      const state = await this.akinator.back(this.akinatorSession);
      this.zone.run(() => this.applyAkinatorState(state));
    } catch (error) {
      this.zone.run(() => { this.akinatorError = error instanceof Error ? error.message : 'Unable to step back.'; });
    } finally {
      this.zone.run(() => { this.akinatorBusy = false; });
    }
  }

  restartAkinator(): void {
    if (!this.akinatorBusy) void this.startAkinator();
  }

  get selectedGameTitle(): string {
    return this.selectedGame === 'cars' ? 'Retro City Drive' : this.selectedGame === 'subway' ? 'Subway Shift' : 'Orbit Courier';
  }

  get selectedGameSubtitle(): string {
    return this.selectedGame === 'cars' ? 'Focal District / free drive' : this.selectedGame === 'subway' ? 'Line 09 / signal run' : 'Deep space / courier route';
  }

  ngOnDestroy(): void {
    this.destroyRenderer();
    if (this.akinatorSession) void this.akinator.close(this.akinatorSession);
  }

  private async startRenderer(game: Exclude<GameId, 'akinator'>, generation: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (generation !== this.renderGeneration || this.selectedGame !== game || !this.canvas) return;
    this.best = Number(window.localStorage.getItem(`focal.games.${game}.best`) || 0);
    this.zone.runOutsideAngular(async () => {
      try {
        if (generation !== this.renderGeneration || this.selectedGame !== game || !this.canvas) return;
        const createGame = game === 'cars'
          ? (await import('./login-v2-game-renderer')).createRetroCarsGame
          : game === 'subway'
            ? (await import('./subway-game-renderer')).createSubwayGame
            : (await import('./spaceship-game-renderer')).createSpaceshipGame;
        this.cleanup = createGame(
          this.canvas.nativeElement,
          (score: number) => this.zone.run(() => {
            this.score = score;
            if (score > this.best) {
              this.best = score;
              window.localStorage.setItem(`focal.games.${game}.best`, String(score));
            }
          }),
          () => this.zone.run(() => this.backToMenu())
        );
      } catch {
        this.zone.run(() => this.backToMenu());
      }
    });
  }

  private async startAkinator(): Promise<void> {
    if (this.akinatorSession) void this.akinator.close(this.akinatorSession);
    this.akinatorSession = '';
    this.akinatorGuess = undefined;
    this.akinatorOffline = false;
    this.akinatorError = '';
    this.akinatorBusy = true;
    try {
      const state = await this.akinator.start();
      this.zone.run(() => this.applyAkinatorState(state));
    } catch {
      this.zone.run(() => {
        this.akinatorOffline = true;
        this.fallbackStep = 0;
        this.akinatorProgress = 8;
        this.akinatorQuestion = this.fallbackQuestions[0];
        this.akinatorAnswers = this.fallbackAnswers;
        this.akinatorError = 'Live link unavailable. Local signal mode is active.';
      });
    } finally {
      this.zone.run(() => { this.akinatorBusy = false; });
    }
  }

  private applyAkinatorState(state: AkinatorState): void {
    this.akinatorSession = state.sessionId;
    this.akinatorQuestion = state.question;
    this.akinatorAnswers = state.answers;
    this.akinatorProgress = Math.round(state.progress);
    this.akinatorGuess = state.guess;
  }

  private destroyRenderer(): void {
    this.cleanup?.();
    this.cleanup = undefined;
  }
}
