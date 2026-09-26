import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, Observable } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TrainingAssetMeta, TrainingAssetService } from '../../services/training-assets';
import {
  TrainingCourse,
  TrainingCourseSummary,
  TrainingLesson,
  TrainingQuizAttempt,
  TrainingService
} from '../../services/training';
import { markdownToSafeHtml } from '../../utils/markdown';

interface FlatLesson {
  moduleTitle: string;
  lesson: TrainingLesson;
}

@Component({
  selector: 'app-training-course-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './training-course-viewer.html',
  styleUrls: ['./training-course-viewer.css']
})
export class TrainingCourseViewer implements OnInit, OnDestroy {
  @ViewChild('lessonVideo') lessonVideoRef?: ElementRef<HTMLVideoElement>;

  course: TrainingCourse | null = null;
  error = '';

  selectedLessonId: number | null = null;
  flat: FlatLesson[] = [];

  quizAnswers: number[] = [];
  lastAttempt: TrainingQuizAttempt | null = null;
  quizSubmitted = false;

  videoUrl: string | null = null;
  videoMeta: TrainingAssetMeta | null = null;
  videoLoading = false;
  videoError = '';
  videoPlaying = false;
  videoMuted = false;
  videoProgress = 0;
  videoCurrentTime = 0;
  videoDuration = 0;
  videoRate = 1;
  videoControlsVisible = true;

  summary$?: Observable<TrainingCourseSummary | null>;

  private timingLessonId: number | null = null;
  private timingStartedAt: number | null = null;
  private videoControlsTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onVisibilityChange = () => (document.hidden ? this.pauseTiming() : this.resumeTiming());
  private readonly onBlur = () => this.pauseTiming();
  private readonly onFocus = () => this.resumeTiming();

  constructor(
    public auth: AuthService,
    private training: TrainingService,
    private assets: TrainingAssetService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    const courseId = Number(raw || 0);
    if (!Number.isFinite(courseId) || courseId <= 0) {
      this.error = 'Invalid course id.';
      return;
    }

    const course = this.training.getCourseById(courseId);
    if (!course) {
      this.error = `Course #${courseId} not found.`;
      return;
    }

    if (!this.canViewCourse(course)) {
      this.error = 'You do not have access to this course.';
      return;
    }

    this.course = course;
    this.flat = this.flatten(course);

    const uid = Number(this.auth.getUser()?.id || 0);
    if (uid > 0) {
      this.training.touchCourse(uid, course.id);
      this.summary$ = combineLatest([this.training.courses$, this.training.assignments$, this.training.progress$]).pipe(
        map(() => this.training.getCourseSummaryForUser(uid, course.id))
      );
      const summary = this.training.getCourseSummaryForUser(uid, course.id);
      this.selectedLessonId = this.pickStartLessonId(summary, course);
    } else {
      this.selectedLessonId = this.flat[0]?.lesson?.id ?? null;
    }

    this.syncQuizState();
    void this.syncVideo();

    this.startTiming();
    this.installTimingListeners();
  }

  ngOnDestroy(): void {
    this.flushTiming();
    this.uninstallTimingListeners();
    this.revokeVideoUrl();
    this.clearVideoControlsTimer();
  }

  get selectedLesson(): TrainingLesson | null {
    if (!this.course || !this.selectedLessonId) return null;
    return this.training.findLesson(this.course, this.selectedLessonId);
  }

  get contentHtml(): string {
    const l = this.selectedLesson;
    if (!l) return '';
    return markdownToSafeHtml(l.contentMarkdown || '');
  }

  selectLesson(lessonId: number): void {
    this.flushTiming();
    this.selectedLessonId = lessonId;
    this.syncQuizState();
    void this.syncVideo();
    this.startTiming();
    const uid = Number(this.auth.getUser()?.id || 0);
    if (uid > 0 && this.course) {
      this.training.touchCourse(uid, this.course.id);
    }
  }

  isCompleted(lessonId: number, summary: TrainingCourseSummary | null): boolean {
    const ids = summary?.progress?.completedLessonIds || [];
    return ids.includes(lessonId);
  }

  markComplete(): void {
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid || !this.course || !this.selectedLessonId) return;
    this.training.markLessonComplete(uid, this.course.id, this.selectedLessonId);
  }

  submitQuiz(): void {
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid || !this.course || !this.selectedLesson) return;
    if (this.selectedLesson.type !== 'QUIZ') return;
    const attempt = this.training.submitQuizAttempt(uid, this.course.id, this.selectedLesson.id, this.quizAnswers);
    this.quizSubmitted = true;
    this.lastAttempt = attempt;
  }

  retryQuiz(): void {
    const lesson = this.selectedLesson;
    if (!lesson?.quiz) return;
    this.quizAnswers = new Array((lesson.quiz.questions || []).length).fill(-1);
    this.quizSubmitted = false;
    this.lastAttempt = null;
  }

  prev(): void {
    const idx = this.flat.findIndex(x => x.lesson.id === this.selectedLessonId);
    if (idx <= 0) return;
    this.selectLesson(this.flat[idx - 1].lesson.id);
  }

  next(): void {
    const idx = this.flat.findIndex(x => x.lesson.id === this.selectedLessonId);
    if (idx < 0 || idx >= this.flat.length - 1) return;
    this.selectLesson(this.flat[idx + 1].lesson.id);
  }

  isFirstLesson(lessonId: number): boolean {
    if (!this.flat.length) return true;
    return this.flat[0].lesson.id === lessonId;
  }

  isLastLesson(lessonId: number): boolean {
    if (!this.flat.length) return true;
    return this.flat[this.flat.length - 1].lesson.id === lessonId;
  }

  private syncQuizState(): void {
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid || !this.course || !this.selectedLessonId) {
      this.quizAnswers = [];
      this.lastAttempt = null;
      this.quizSubmitted = false;
      return;
    }
    const lesson = this.selectedLesson;
    if (!lesson || lesson.type !== 'QUIZ' || !lesson.quiz) {
      this.quizAnswers = [];
      this.lastAttempt = null;
      this.quizSubmitted = false;
      return;
    }
    const attempt = this.training.getLatestAttempt(uid, this.course.id, lesson.id);
    const qCount = (lesson.quiz.questions || []).length;
    this.lastAttempt = attempt;
    this.quizAnswers = attempt?.answers?.length ? attempt.answers.slice(0, qCount) : new Array(qCount).fill(-1);
    this.quizSubmitted = false;
  }

  private async syncVideo(): Promise<void> {
    this.videoError = '';
    this.videoMeta = null;
    this.videoLoading = false;
    this.resetVideoUi();
    this.revokeVideoUrl();
    const lesson = this.selectedLesson;
    if (!lesson || lesson.type !== 'VIDEO') return;
    const id = (lesson.assetId || '').toString().trim();
    if (!id) return;
    this.videoLoading = true;
    try {
      const [meta, blob] = await Promise.all([this.assets.getMeta(id), this.assets.getBlob(id)]);
      this.videoMeta = meta;
      if (!blob) {
        this.videoError = 'Uploaded video not found on server.';
        return;
      }
      this.videoUrl = URL.createObjectURL(blob);
    } catch (e: any) {
      this.videoError = e?.message || 'Could not load video.';
    } finally {
      this.videoLoading = false;
    }
  }

  private revokeVideoUrl(): void {
    if (this.videoUrl) {
      URL.revokeObjectURL(this.videoUrl);
      this.videoUrl = null;
    }
  }

  onVideoMetadata(): void {
    const video = this.lessonVideoRef?.nativeElement;
    if (!video) return;
    this.videoDuration = this.safeSeconds(video.duration);
    this.videoCurrentTime = this.safeSeconds(video.currentTime);
    this.videoProgress = this.videoDuration > 0 ? (this.videoCurrentTime / this.videoDuration) * 100 : 0;
  }

  onVideoTimeUpdate(): void {
    const video = this.lessonVideoRef?.nativeElement;
    if (!video) return;
    this.videoCurrentTime = this.safeSeconds(video.currentTime);
    this.videoDuration = this.safeSeconds(video.duration);
    this.videoProgress = this.videoDuration > 0 ? (this.videoCurrentTime / this.videoDuration) * 100 : 0;
  }

  onVideoPlay(): void {
    this.videoPlaying = true;
    this.showVideoControlsTemporarily();
  }

  onVideoPause(): void {
    this.videoPlaying = false;
    this.videoControlsVisible = true;
    this.clearVideoControlsTimer();
  }

  onVideoVolumeChange(): void {
    const video = this.lessonVideoRef?.nativeElement;
    if (!video) return;
    this.videoMuted = video.muted || video.volume <= 0;
  }

  toggleVideoPlay(): void {
    const video = this.lessonVideoRef?.nativeElement;
    if (!video) return;
    this.showVideoControlsTemporarily();
    if (video.paused) {
      void video.play().catch(() => undefined);
      return;
    }
    video.pause();
  }

  seekVideo(deltaSeconds: number): void {
    const video = this.lessonVideoRef?.nativeElement;
    if (!video) return;
    const next = Math.max(0, Math.min(this.videoDuration || video.duration || 0, video.currentTime + deltaSeconds));
    video.currentTime = next;
    this.onVideoTimeUpdate();
  }

  onProgressInput(value: string | number): void {
    const video = this.lessonVideoRef?.nativeElement;
    if (!video) return;
    this.showVideoControlsTemporarily();
    const pct = Number(value);
    if (!Number.isFinite(pct)) return;
    const duration = this.videoDuration || this.safeSeconds(video.duration);
    if (duration <= 0) return;
    const next = (Math.max(0, Math.min(100, pct)) / 100) * duration;
    video.currentTime = next;
    this.onVideoTimeUpdate();
  }

  toggleVideoMute(): void {
    const video = this.lessonVideoRef?.nativeElement;
    if (!video) return;
    this.showVideoControlsTemporarily();
    video.muted = !video.muted;
    this.onVideoVolumeChange();
  }

  setVideoRate(rate: number): void {
    const video = this.lessonVideoRef?.nativeElement;
    if (!video) return;
    this.showVideoControlsTemporarily();
    const nextRate = Number(rate);
    if (!Number.isFinite(nextRate) || nextRate <= 0) return;
    video.playbackRate = nextRate;
    this.videoRate = nextRate;
  }

  async enterVideoFullscreen(): Promise<void> {
    const video = this.lessonVideoRef?.nativeElement;
    if (!video || typeof document === 'undefined') return;
    this.showVideoControlsTemporarily();
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    await video.requestFullscreen?.().catch(() => undefined);
  }

  onVideoStagePointerMove(): void {
    this.showVideoControlsTemporarily();
  }

  onVideoStagePointerLeave(): void {
    if (this.videoPlaying) {
      this.videoControlsVisible = false;
      this.clearVideoControlsTimer();
    }
  }

  formatVideoTime(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  formatBytes(size: number): string {
    const bytes = Number(size || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, idx);
    const rounded = value >= 10 || idx === 0 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded} ${units[idx]}`;
  }

  private startTiming(): void {
    if (typeof window === 'undefined') return;
    if (!this.course || !this.selectedLessonId) return;
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid) return;
    this.timingLessonId = this.selectedLessonId;
    this.timingStartedAt = Date.now();
  }

  private flushTiming(): void {
    if (!this.course || !this.timingLessonId || !this.timingStartedAt) return;
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid) return;
    const delta = Date.now() - this.timingStartedAt;
    if (Number.isFinite(delta) && delta > 250) {
      this.training.addLessonTime(uid, this.course.id, this.timingLessonId, delta);
    }
    this.timingStartedAt = Date.now();
    this.timingLessonId = this.selectedLessonId;
  }

  private pauseTiming(): void {
    if (!this.course) return;
    if (!this.timingStartedAt) return;
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid || !this.timingLessonId) {
      this.timingStartedAt = null;
      return;
    }
    const delta = Date.now() - this.timingStartedAt;
    if (Number.isFinite(delta) && delta > 250) {
      this.training.addLessonTime(uid, this.course.id, this.timingLessonId, delta);
    }
    this.timingStartedAt = null;
  }

  private resumeTiming(): void {
    if (typeof window === 'undefined') return;
    if (this.timingStartedAt) return;
    if (!this.course || !this.selectedLessonId) return;
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid) return;
    this.timingLessonId = this.selectedLessonId;
    this.timingStartedAt = Date.now();
  }

  private installTimingListeners(): void {
    if (typeof window === 'undefined') return;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
  }

  private uninstallTimingListeners(): void {
    if (typeof window === 'undefined') return;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
  }

  private pickStartLessonId(summary: TrainingCourseSummary | null, course: TrainingCourse): number | null {
    const completed = new Set((summary?.progress?.completedLessonIds || []).map(v => Number(v)));
    for (const item of this.flatten(course)) {
      if (!completed.has(item.lesson.id)) return item.lesson.id;
    }
    return this.flatten(course)[0]?.lesson.id ?? null;
  }

  private flatten(course: TrainingCourse): FlatLesson[] {
    const mods = [...(course.modules || [])].sort((a, b) => a.order - b.order);
    const out: FlatLesson[] = [];
    for (const m of mods) {
      const lessons = [...(m.lessons || [])].sort((a, b) => a.order - b.order);
      for (const l of lessons) out.push({ moduleTitle: m.title, lesson: l });
    }
    return out;
  }

  private canViewCourse(course: TrainingCourse): boolean {
    const role = this.auth.getNormalizedRole();
    if (['ADMIN', 'HEAD_CS', 'OPS', 'TEAM_LEADER', 'QA'].includes(role)) return true;
    // Agents: only published courses (they can preview or enroll).
    return course.status === 'PUBLISHED';
  }

  private resetVideoUi(): void {
    this.videoPlaying = false;
    this.videoMuted = false;
    this.videoProgress = 0;
    this.videoCurrentTime = 0;
    this.videoDuration = 0;
    this.videoRate = 1;
    this.videoControlsVisible = true;
    this.clearVideoControlsTimer();
  }

  private safeSeconds(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private showVideoControlsTemporarily(): void {
    this.videoControlsVisible = true;
    this.clearVideoControlsTimer();
    if (!this.videoPlaying) return;
    this.videoControlsTimer = setTimeout(() => {
      this.videoControlsVisible = false;
    }, 2200);
  }

  private clearVideoControlsTimer(): void {
    if (!this.videoControlsTimer) return;
    clearTimeout(this.videoControlsTimer);
    this.videoControlsTimer = null;
  }
}
