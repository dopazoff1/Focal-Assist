import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { TrainingAssetMeta, TrainingAssetService } from '../../services/training-assets';
import {
  TrainingCourse,
  TrainingDifficulty,
  TrainingLesson,
  TrainingLessonType,
  TrainingModule,
  TrainingQuizQuestion,
  TrainingService
} from '../../services/training';
import { markdownToSafeHtml } from '../../utils/markdown';

type LessonEditorMode = 'CONTENT' | 'PREVIEW';

@Component({
  selector: 'app-training-course-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './training-course-editor.html',
  styleUrls: ['./training-course-editor.css']
})
export class TrainingCourseEditor implements OnInit {
  course: TrainingCourse | null = null;
  error = '';
  info = '';
  dirty = false;

  selectedModuleId: number | null = null;
  selectedLessonId: number | null = null;
  lessonMode: LessonEditorMode = 'CONTENT';

  addLessonType: TrainingLessonType = 'LESSON';

  videoUploading = false;
  videoMetaLoading = false;
  videoMeta: TrainingAssetMeta | null = null;

  constructor(
    public auth: AuthService,
    private training: TrainingService,
    private assets: TrainingAssetService,
    private route: ActivatedRoute,
    private router: Router
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
    // Work on a deep clone to avoid mutating service state until Save.
    this.course = JSON.parse(JSON.stringify(course)) as TrainingCourse;
    this.normalizeOrders();
    this.selectedModuleId = this.course.modules[0]?.id ?? null;
    this.selectedLessonId = this.course.modules[0]?.lessons?.[0]?.id ?? null;
    void this.refreshSelectedVideoMeta();
  }

  get canPublish(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS', 'OPS', 'TEAM_LEADER', 'QA');
  }

  get allCoursesForPrereqs(): TrainingCourse[] {
    if (!this.course) return [];
    return this.training.courses
      .filter(c => c.id !== this.course!.id)
      .filter(c => c.status !== 'ARCHIVED')
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  get selectedModule(): TrainingModule | null {
    if (!this.course || !this.selectedModuleId) return null;
    return this.course.modules.find(m => m.id === this.selectedModuleId) ?? null;
  }

  get selectedLesson(): TrainingLesson | null {
    if (!this.course || !this.selectedLessonId) return null;
    for (const m of this.course.modules) {
      const hit = m.lessons.find(l => l.id === this.selectedLessonId);
      if (hit) return hit;
    }
    return null;
  }

  get lessonPreviewHtml(): string {
    const lesson = this.selectedLesson;
    if (!lesson) return '';
    const content = lesson.contentMarkdown || '';
    return markdownToSafeHtml(content);
  }

  setDirty(): void {
    this.dirty = true;
    this.info = '';
  }

  selectLesson(modId: number, lessonId: number): void {
    this.selectedModuleId = modId;
    this.selectedLessonId = lessonId;
    this.lessonMode = 'CONTENT';
    void this.refreshSelectedVideoMeta();
  }

  backToStudio(): void {
    void this.router.navigate(['../../'], { relativeTo: this.route });
  }

  save(): void {
    if (!this.course) return;
    this.normalizeOrders();
    this.training.saveCourse(this.course);
    this.dirty = false;
    this.info = 'Saved.';
    this.error = '';
  }

  publish(): void {
    if (!this.course) return;
    this.save();
    this.training.publishCourse(this.course.id);
    const updated = this.training.getCourseById(this.course.id);
    if (updated) this.course = JSON.parse(JSON.stringify(updated)) as TrainingCourse;
    this.info = 'Published.';
  }

  unpublish(): void {
    if (!this.course) return;
    this.save();
    this.training.unpublishCourse(this.course.id);
    const updated = this.training.getCourseById(this.course.id);
    if (updated) this.course = JSON.parse(JSON.stringify(updated)) as TrainingCourse;
    this.info = 'Unpublished (draft).';
  }

  archive(): void {
    if (!this.course) return;
    this.save();
    this.training.archiveCourse(this.course.id);
    const updated = this.training.getCourseById(this.course.id);
    if (updated) this.course = JSON.parse(JSON.stringify(updated)) as TrainingCourse;
    this.info = 'Archived.';
  }

  addModule(): void {
    if (!this.course) return;
    const id = this.training.allocateModuleId();
    const order = (this.course.modules?.length || 0) + 1;
    const mod: TrainingModule = { id, title: `Module ${order}`, order, lessons: [] };
    this.course.modules.push(mod);
    this.selectedModuleId = mod.id;
    this.selectedLessonId = null;
    this.setDirty();
  }

  renameModule(mod: TrainingModule, title: string): void {
    mod.title = title;
    this.setDirty();
  }

  moveModule(modId: number, dir: -1 | 1): void {
    if (!this.course) return;
    const idx = this.course.modules.findIndex(m => m.id === modId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= this.course.modules.length) return;
    const tmp = this.course.modules[idx];
    this.course.modules[idx] = this.course.modules[next];
    this.course.modules[next] = tmp;
    this.normalizeOrders();
    this.setDirty();
  }

  deleteModule(modId: number): void {
    if (!this.course) return;
    this.course.modules = this.course.modules.filter(m => m.id !== modId);
    if (this.selectedModuleId === modId) {
      this.selectedModuleId = this.course.modules[0]?.id ?? null;
      this.selectedLessonId = this.course.modules[0]?.lessons?.[0]?.id ?? null;
    }
    this.normalizeOrders();
    this.setDirty();
  }

  addLesson(modId: number): void {
    if (!this.course) return;
    const mod = this.course.modules.find(m => m.id === modId);
    if (!mod) return;
    const id = this.training.allocateLessonId();
    const order = (mod.lessons?.length || 0) + 1;
    const lesson: TrainingLesson = {
      id,
      title: `${this.addLessonType === 'QUIZ' ? 'Quiz' : 'Lesson'} ${order}`,
      type: this.addLessonType,
      order,
      contentMarkdown: '',
      url: '',
      quiz: this.addLessonType === 'QUIZ'
        ? { passingScore: 80, questions: [] }
        : undefined
    };
    mod.lessons.push(lesson);
    this.selectedModuleId = mod.id;
    this.selectedLessonId = lesson.id;
    this.lessonMode = 'CONTENT';
    void this.refreshSelectedVideoMeta();
    this.setDirty();
  }

  moveLesson(lessonId: number, dir: -1 | 1): void {
    if (!this.course) return;
    for (const mod of this.course.modules) {
      const idx = mod.lessons.findIndex(l => l.id === lessonId);
      if (idx < 0) continue;
      const next = idx + dir;
      if (next < 0 || next >= mod.lessons.length) return;
      const tmp = mod.lessons[idx];
      mod.lessons[idx] = mod.lessons[next];
      mod.lessons[next] = tmp;
      this.normalizeOrders();
      this.setDirty();
      return;
    }
  }

  deleteLesson(lessonId: number): void {
    if (!this.course) return;
    for (const mod of this.course.modules) {
      const before = mod.lessons.length;
      mod.lessons = mod.lessons.filter(l => l.id !== lessonId);
      if (mod.lessons.length !== before) {
        if (this.selectedLessonId === lessonId) {
          this.selectedLessonId = mod.lessons[0]?.id ?? null;
        }
        this.normalizeOrders();
        void this.refreshSelectedVideoMeta();
        this.setDirty();
        return;
      }
    }
  }

  addQuestion(): void {
    const lesson = this.selectedLesson;
    if (!lesson || lesson.type !== 'QUIZ') return;
    if (!lesson.quiz) lesson.quiz = { passingScore: 80, questions: [] };
    const id = this.training.allocateQuestionId();
    const q: TrainingQuizQuestion = {
      id,
      prompt: 'New question',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      explanation: ''
    };
    lesson.quiz.questions.push(q);
    this.setDirty();
  }

  deleteQuestion(questionId: number): void {
    const lesson = this.selectedLesson;
    if (!lesson?.quiz) return;
    lesson.quiz.questions = (lesson.quiz.questions || []).filter(q => q.id !== questionId);
    this.setDirty();
  }

  togglePrereq(courseId: number): void {
    if (!this.course) return;
    const current = new Set((this.course.prerequisites || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0));
    if (current.has(courseId)) current.delete(courseId);
    else current.add(courseId);
    this.course.prerequisites = Array.from(current);
    this.setDirty();
  }

  tagsToText(tags: string[]): string {
    return (tags || []).join(', ');
  }

  textToTags(raw: string): string[] {
    return [...new Set((raw || '').split(',').map(s => s.trim()).filter(Boolean))];
  }

  setDifficulty(value: string): void {
    if (!this.course) return;
    this.course.difficulty = (value as TrainingDifficulty) || 'BEGINNER';
    this.setDirty();
  }

  setLessonType(value: string): void {
    const lesson = this.selectedLesson;
    if (!lesson) return;
    const next = (value as TrainingLessonType) || 'LESSON';
    lesson.type = next;
    if (next === 'QUIZ' && !lesson.quiz) lesson.quiz = { passingScore: 80, questions: [] };
    if (next !== 'QUIZ') lesson.quiz = undefined;
    void this.refreshSelectedVideoMeta();
    this.setDirty();
  }

  async attachVideo(evt: Event, lesson: TrainingLesson): Promise<void> {
    const input = evt.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) return;
    if (lesson.type !== 'VIDEO') return;

    const maxBytes = 250 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.error = `Video is too large (${Math.round(file.size / (1024 * 1024))}MB). Max is 250MB.`;
      if (input) input.value = '';
      return;
    }

    this.videoUploading = true;
    this.error = '';
    try {
      const meta = await this.assets.saveVideo(file);
      lesson.assetId = meta.id;
      this.videoMeta = meta;
      this.info = `Video uploaded: ${meta.filename}`;
      this.setDirty();
    } catch (e: any) {
      this.error = e?.message || 'Could not upload video.';
    } finally {
      this.videoUploading = false;
      if (input) input.value = '';
    }
  }

  async removeVideo(lesson: TrainingLesson): Promise<void> {
    if (lesson.type !== 'VIDEO') return;
    const id = (lesson.assetId || '').toString().trim();
    if (!id) {
      lesson.assetId = undefined;
      this.videoMeta = null;
      this.setDirty();
      return;
    }
    try {
      await this.assets.delete(id);
    } catch {
      // Ignore delete errors; detaching is still useful.
    }
    lesson.assetId = undefined;
    this.videoMeta = null;
    this.info = 'Video removed.';
    this.setDirty();
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

  private async refreshSelectedVideoMeta(): Promise<void> {
    this.videoMeta = null;
    const lesson = this.selectedLesson;
    if (!lesson || lesson.type !== 'VIDEO') return;
    const id = (lesson.assetId || '').toString().trim();
    if (!id) return;
    this.videoMetaLoading = true;
    try {
      this.videoMeta = await this.assets.getMeta(id);
    } catch {
      this.videoMeta = null;
    } finally {
      this.videoMetaLoading = false;
    }
  }

  private normalizeOrders(): void {
    if (!this.course) return;
    this.course.modules = (this.course.modules || [])
      .map(m => ({ ...m, lessons: Array.isArray(m.lessons) ? m.lessons : [] }))
      .sort((a, b) => a.order - b.order)
      .map((m, idx) => ({
        ...m,
        order: idx + 1,
        lessons: (m.lessons || [])
          .sort((a, b) => a.order - b.order)
          .map((l, lidx) => ({ ...l, order: lidx + 1 }))
      }));
  }

  lessonCount(course: TrainingCourse): number {
    return (course.modules || []).reduce((sum, m) => sum + ((m.lessons || []).length), 0);
  }
}
