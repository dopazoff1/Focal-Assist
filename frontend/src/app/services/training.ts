import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { ServerStateService } from './server-state';

export type TrainingCourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type TrainingDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type TrainingLessonType = 'LESSON' | 'QUIZ' | 'LINK' | 'VIDEO';
export type TrainingProgressState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface TrainingQuizQuestion {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface TrainingQuiz {
  passingScore: number; // 0-100
  questions: TrainingQuizQuestion[];
}

export interface TrainingLesson {
  id: number;
  title: string;
  type: TrainingLessonType;
  order: number;
  contentMarkdown?: string;
  url?: string;
  // Stores a reference to an uploaded asset (server-side via TrainingAssetService).
  assetId?: string;
  quiz?: TrainingQuiz;
}

export interface TrainingModule {
  id: number;
  title: string;
  order: number;
  lessons: TrainingLesson[];
}

export interface TrainingCourse {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  status: TrainingCourseStatus;
  tags: string[];
  difficulty: TrainingDifficulty;
  estimatedMinutes: number;
  allowSelfEnroll: boolean;
  prerequisites: number[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  version: number;
  modules: TrainingModule[];
}

export interface TrainingAssignment {
  courseId: number;
  userId: number;
  assignedBy: number;
  assignedAt: string;
  dueAt?: string | null;
  mandatory: boolean;
}

export interface TrainingQuizAttempt {
  attemptedAt: string;
  answers: number[];
  score: number;
  passed: boolean;
}

export interface TrainingProgress {
  courseId: number;
  userId: number;
  state: TrainingProgressState;
  startedAt?: string | null;
  lastSeenAt?: string | null;
  completedAt?: string | null;
  completedLessonIds: number[];
  quizAttemptsByLessonId: Record<number, TrainingQuizAttempt[]>;
  timeSpentMsByLessonId: Record<number, number>;
}

export interface TrainingCourseSummary {
  course: TrainingCourse;
  assignment: TrainingAssignment | null;
  progress: TrainingProgress | null;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  isOverdue: boolean;
}

interface TrainingState {
  courses: TrainingCourse[];
  assignments: TrainingAssignment[];
  progress: TrainingProgress[];
  nextCourseId: number;
  nextModuleId: number;
  nextLessonId: number;
  nextQuestionId: number;
}

@Injectable({ providedIn: 'root' })
export class TrainingService {
  private readonly storageKey = 'training-state-v1';
  private readonly state$ = new BehaviorSubject<TrainingState>(this.seedState());
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistInFlight = false;
  private pendingPersist = false;

  readonly courses$ = this.state$.asObservable().pipe(map(s => s.courses));
  readonly assignments$ = this.state$.asObservable().pipe(map(s => s.assignments));
  readonly progress$ = this.state$.asObservable().pipe(map(s => s.progress));
  constructor(private serverState: ServerStateService) {
    if (typeof window === 'undefined') return;
    this.serverState.loadState<TrainingState>(this.storageKey).subscribe({
      next: (remote) => {
        if (remote) {
          this.state$.next(this.normalizeState(remote));
          return;
        }
        this.schedulePersist();
      },
      error: () => {
        // Keep seeded state in memory if server load fails.
      }
    });
  }

  get courses(): TrainingCourse[] {
    return this.state$.value.courses;
  }

  get assignments(): TrainingAssignment[] {
    return this.state$.value.assignments;
  }

  get progress(): TrainingProgress[] {
    return this.state$.value.progress;
  }

  getCourseById(courseId: number): TrainingCourse | null {
    const id = Number(courseId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return this.courses.find(c => c.id === id) ?? null;
  }

  listPublishedCourses(): TrainingCourse[] {
    return this.courses.filter(c => c.status === 'PUBLISHED');
  }

  listCoursesForStudio(): TrainingCourse[] {
    return [...this.courses].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  listAssignedSummaries(userId: number): TrainingCourseSummary[] {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) return [];

    const courseIds = new Set(
      this.assignments
        .filter(a => Number(a.userId) === uid)
        .map(a => Number(a.courseId))
        .filter(v => Number.isFinite(v) && v > 0)
    );

    const rows = Array.from(courseIds)
      .map(courseId => this.getCourseSummaryForUser(uid, courseId))
      .filter(Boolean) as TrainingCourseSummary[];

    const stateRank: Record<TrainingProgressState, number> = { IN_PROGRESS: 0, NOT_STARTED: 1, COMPLETED: 2 };
    const dueTime = (s: TrainingCourseSummary) => (s.assignment?.dueAt ? new Date(s.assignment.dueAt).getTime() : Number.POSITIVE_INFINITY);
    return rows.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const aState = (a.progress?.state ?? 'NOT_STARTED') as TrainingProgressState;
      const bState = (b.progress?.state ?? 'NOT_STARTED') as TrainingProgressState;
      if (stateRank[aState] !== stateRank[bState]) return stateRank[aState] - stateRank[bState];
      const aDue = dueTime(a);
      const bDue = dueTime(b);
      if (aDue !== bDue) return aDue - bDue;
      return b.course.updatedAt.localeCompare(a.course.updatedAt);
    });
  }

  getCourseSummaryForUser(userId: number, courseId: number): TrainingCourseSummary | null {
    const uid = Number(userId);
    const cid = Number(courseId);
    if (!Number.isFinite(uid) || uid <= 0) return null;
    if (!Number.isFinite(cid) || cid <= 0) return null;
    const course = this.getCourseById(cid);
    if (!course) return null;

    const assignment = this.assignments.find(a => a.courseId === cid && a.userId === uid) ?? null;
    const progress = this.progress.find(p => p.courseId === cid && p.userId === uid) ?? null;
    const totalLessons = this.countTotalLessons(course);
    const completedLessons = progress?.completedLessonIds?.length || 0;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    const dueMs = assignment?.dueAt ? new Date(assignment.dueAt).getTime() : null;
    const isOverdue = !!(dueMs && Number.isFinite(dueMs) && dueMs < Date.now() && (progress?.state ?? 'NOT_STARTED') !== 'COMPLETED');

    return {
      course,
      assignment,
      progress,
      progressPercent,
      completedLessons,
      totalLessons,
      isOverdue
    };
  }

  allocateCourseId(): number {
    const state = this.state$.value;
    const next = state.nextCourseId;
    this.commit({ ...state, nextCourseId: next + 1 });
    return next;
  }

  allocateModuleId(): number {
    const state = this.state$.value;
    const next = state.nextModuleId;
    this.commit({ ...state, nextModuleId: next + 1 });
    return next;
  }

  allocateLessonId(): number {
    const state = this.state$.value;
    const next = state.nextLessonId;
    this.commit({ ...state, nextLessonId: next + 1 });
    return next;
  }

  allocateQuestionId(): number {
    const state = this.state$.value;
    const next = state.nextQuestionId;
    this.commit({ ...state, nextQuestionId: next + 1 });
    return next;
  }

  createCourse(createdBy: number): TrainingCourse {
    const state = this.state$.value;
    const id = this.allocateCourseId();
    const now = new Date().toISOString();
    const course: TrainingCourse = {
      id,
      title: 'Untitled training',
      subtitle: '',
      description: '',
      status: 'DRAFT',
      tags: [],
      difficulty: 'BEGINNER',
      estimatedMinutes: 10,
      allowSelfEnroll: false,
      prerequisites: [],
      createdBy: Number(createdBy) || 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      archivedAt: null,
      version: 1,
      modules: []
    };
    this.commit({ ...this.state$.value, courses: [course, ...state.courses] });
    return course;
  }

  saveCourse(course: TrainingCourse): void {
    const state = this.state$.value;
    const normalized = this.normalizeCourse(course);
    const exists = state.courses.some(c => c.id === normalized.id);
    const courses = exists
      ? state.courses.map(c => (c.id === normalized.id ? normalized : c))
      : [normalized, ...state.courses];
    this.commit({ ...state, courses });
  }

  publishCourse(courseId: number): void {
    const course = this.getCourseById(courseId);
    if (!course) return;
    const now = new Date().toISOString();
    this.saveCourse({
      ...course,
      status: 'PUBLISHED',
      publishedAt: course.publishedAt || now,
      archivedAt: null,
      updatedAt: now,
      version: Math.max(1, Number(course.version || 1)) + 1
    });
  }

  unpublishCourse(courseId: number): void {
    const course = this.getCourseById(courseId);
    if (!course) return;
    const now = new Date().toISOString();
    this.saveCourse({
      ...course,
      status: 'DRAFT',
      updatedAt: now,
      version: Math.max(1, Number(course.version || 1)) + 1
    });
  }

  archiveCourse(courseId: number): void {
    const course = this.getCourseById(courseId);
    if (!course) return;
    const now = new Date().toISOString();
    this.saveCourse({
      ...course,
      status: 'ARCHIVED',
      archivedAt: now,
      updatedAt: now
    });
  }

  deleteCourse(courseId: number): void {
    const state = this.state$.value;
    const id = Number(courseId);
    if (!Number.isFinite(id) || id <= 0) return;
    this.commit({
      ...state,
      courses: state.courses.filter(c => c.id !== id),
      assignments: state.assignments.filter(a => a.courseId !== id),
      progress: state.progress.filter(p => p.courseId !== id)
    });
  }

  duplicateCourse(courseId: number, createdBy: number): TrainingCourse | null {
    const source = this.getCourseById(courseId);
    if (!source) return null;
    const now = new Date().toISOString();
    const copy: TrainingCourse = {
      ...source,
      id: this.allocateCourseId(),
      title: `${source.title} (Copy)`,
      status: 'DRAFT',
      createdBy: Number(createdBy) || 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      archivedAt: null,
      version: 1,
      modules: this.deepCloneModules(source.modules || [])
    };
    const state = this.state$.value;
    this.commit({ ...state, courses: [copy, ...state.courses] });
    return copy;
  }

  isUserAssigned(userId: number, courseId: number): boolean {
    const uid = Number(userId);
    const cid = Number(courseId);
    if (!Number.isFinite(uid) || uid <= 0) return false;
    if (!Number.isFinite(cid) || cid <= 0) return false;
    return this.assignments.some(a => a.userId === uid && a.courseId === cid);
  }

  selfEnroll(userId: number, courseId: number): void {
    const uid = Number(userId);
    const cid = Number(courseId);
    if (!Number.isFinite(uid) || uid <= 0) return;
    if (!Number.isFinite(cid) || cid <= 0) return;
    const course = this.getCourseById(cid);
    if (!course || course.status !== 'PUBLISHED' || !course.allowSelfEnroll) return;
    if (this.isUserAssigned(uid, cid)) return;
    this.assignCourse(cid, [uid], uid, null, false);
  }

  assignCourse(courseId: number, userIds: number[], assignedBy: number, dueAt: string | null, mandatory: boolean): void {
    const cid = Number(courseId);
    if (!Number.isFinite(cid) || cid <= 0) return;
    const now = new Date().toISOString();
    const due = (dueAt || '').trim() || null;
    const uniqueUserIds = [...new Set((userIds || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0))];
    if (!uniqueUserIds.length) return;

    const state = this.state$.value;
    let assignments = [...state.assignments];
    for (const uid of uniqueUserIds) {
      const idx = assignments.findIndex(a => a.courseId === cid && a.userId === uid);
      const row: TrainingAssignment = {
        courseId: cid,
        userId: uid,
        assignedBy: Number(assignedBy) || 0,
        assignedAt: now,
        dueAt: due,
        mandatory: !!mandatory
      };
      if (idx >= 0) assignments[idx] = row;
      else assignments.push(row);
    }
    this.commit({ ...state, assignments });
  }

  unassignCourse(courseId: number, userId: number): void {
    const cid = Number(courseId);
    const uid = Number(userId);
    if (!Number.isFinite(cid) || cid <= 0) return;
    if (!Number.isFinite(uid) || uid <= 0) return;
    const state = this.state$.value;
    this.commit({ ...state, assignments: state.assignments.filter(a => !(a.courseId === cid && a.userId === uid)) });
  }

  touchCourse(userId: number, courseId: number): void {
    const uid = Number(userId);
    const cid = Number(courseId);
    if (!Number.isFinite(uid) || uid <= 0) return;
    if (!Number.isFinite(cid) || cid <= 0) return;
    const now = new Date().toISOString();

    const state = this.state$.value;
    const existing = state.progress.find(p => p.userId === uid && p.courseId === cid) ?? null;
    if (!existing) {
      const row: TrainingProgress = {
        userId: uid,
        courseId: cid,
        state: 'IN_PROGRESS',
        startedAt: now,
        lastSeenAt: now,
        completedAt: null,
        completedLessonIds: [],
        quizAttemptsByLessonId: {},
        timeSpentMsByLessonId: {}
      };
      this.commit({ ...state, progress: [...state.progress, row] });
      return;
    }
    const progress = state.progress.map(p => {
      if (p.userId !== uid || p.courseId !== cid) return p;
      return {
        ...p,
        completedLessonIds: Array.isArray(p.completedLessonIds) ? p.completedLessonIds : [],
        quizAttemptsByLessonId: p.quizAttemptsByLessonId || {},
        timeSpentMsByLessonId: p.timeSpentMsByLessonId || {},
        state: (p.state === 'NOT_STARTED' ? 'IN_PROGRESS' : p.state) as TrainingProgressState,
        startedAt: p.startedAt || now,
        lastSeenAt: now
      };
    });
    this.commit({ ...state, progress });
  }

  addLessonTime(userId: number, courseId: number, lessonId: number, deltaMs: number): void {
    const uid = Number(userId);
    const cid = Number(courseId);
    const lid = Number(lessonId);
    const ms = Math.round(Number(deltaMs));
    if (!Number.isFinite(uid) || uid <= 0) return;
    if (!Number.isFinite(cid) || cid <= 0) return;
    if (!Number.isFinite(lid) || lid <= 0) return;
    if (!Number.isFinite(ms) || ms <= 0) return;

    // Create progress row if missing.
    this.touchCourse(uid, cid);

    const state = this.state$.value;
    const now = new Date().toISOString();
    const progress = state.progress.map(p => {
      if (p.userId !== uid || p.courseId !== cid) return p;
      const byLesson = { ...(p.timeSpentMsByLessonId || {}) } as Record<number, number>;
      const prev = Number(byLesson[lid] || 0);
      byLesson[lid] = Math.max(0, prev + ms);
      return {
        ...p,
        timeSpentMsByLessonId: byLesson,
        lastSeenAt: now
      };
    });
    this.commit({ ...state, progress });
  }

  markLessonComplete(userId: number, courseId: number, lessonId: number): void {
    const uid = Number(userId);
    const cid = Number(courseId);
    const lid = Number(lessonId);
    if (!Number.isFinite(uid) || uid <= 0) return;
    if (!Number.isFinite(cid) || cid <= 0) return;
    if (!Number.isFinite(lid) || lid <= 0) return;

    this.touchCourse(uid, cid);
    const state = this.state$.value;
    const now = new Date().toISOString();

    const progress = state.progress.map(p => {
      if (p.userId !== uid || p.courseId !== cid) return p;
      const completed = new Set((p.completedLessonIds || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0));
      completed.add(lid);
      return {
        ...p,
        state: 'IN_PROGRESS' as TrainingProgressState,
        completedLessonIds: Array.from(completed),
        lastSeenAt: now
      };
    });

    this.commit({ ...state, progress });
    this.maybeCompleteCourse(uid, cid);
  }

  submitQuizAttempt(userId: number, courseId: number, lessonId: number, answers: number[]): TrainingQuizAttempt | null {
    const uid = Number(userId);
    const cid = Number(courseId);
    const lid = Number(lessonId);
    if (!Number.isFinite(uid) || uid <= 0) return null;
    if (!Number.isFinite(cid) || cid <= 0) return null;
    if (!Number.isFinite(lid) || lid <= 0) return null;

    const course = this.getCourseById(cid);
    if (!course) return null;
    const lesson = this.findLesson(course, lid);
    if (!lesson || lesson.type !== 'QUIZ' || !lesson.quiz) return null;

    const questions = lesson.quiz.questions || [];
    const normalizedAnswers = (answers || []).map(v => (Number.isFinite(Number(v)) ? Number(v) : -1));
    const score = this.scoreQuiz(questions, normalizedAnswers);
    const passed = score >= Math.min(100, Math.max(0, Number(lesson.quiz.passingScore ?? 0)));
    const attempt: TrainingQuizAttempt = {
      attemptedAt: new Date().toISOString(),
      answers: questions.map((_, idx) => (idx < normalizedAnswers.length ? normalizedAnswers[idx] : -1)),
      score,
      passed
    };

    this.touchCourse(uid, cid);
    const state = this.state$.value;
    const progress = state.progress.map(p => {
      if (p.userId !== uid || p.courseId !== cid) return p;
      const byLesson = { ...(p.quizAttemptsByLessonId || {}) };
      const list = Array.isArray(byLesson[lid]) ? [...byLesson[lid]] : [];
      byLesson[lid] = [attempt, ...list].slice(0, 10);
      return { ...p, quizAttemptsByLessonId: byLesson, lastSeenAt: attempt.attemptedAt };
    });
    this.commit({ ...state, progress });

    if (attempt.passed) {
      this.markLessonComplete(uid, cid, lid);
    }

    return attempt;
  }

  getLatestAttempt(userId: number, courseId: number, lessonId: number): TrainingQuizAttempt | null {
    const uid = Number(userId);
    const cid = Number(courseId);
    const lid = Number(lessonId);
    if (!Number.isFinite(uid) || uid <= 0) return null;
    if (!Number.isFinite(cid) || cid <= 0) return null;
    if (!Number.isFinite(lid) || lid <= 0) return null;
    const row = this.progress.find(p => p.userId === uid && p.courseId === cid);
    const list = row?.quizAttemptsByLessonId?.[lid];
    return Array.isArray(list) && list.length > 0 ? list[0] : null;
  }

  findLesson(course: TrainingCourse, lessonId: number): TrainingLesson | null {
    const lid = Number(lessonId);
    if (!Number.isFinite(lid) || lid <= 0) return null;
    for (const mod of course.modules || []) {
      for (const lesson of mod.lessons || []) {
        if (lesson.id === lid) return lesson;
      }
    }
    return null;
  }

  countTotalLessons(course: TrainingCourse): number {
    return (course.modules || []).reduce((sum, m) => sum + ((m.lessons || []).length), 0);
  }

  private maybeCompleteCourse(userId: number, courseId: number): void {
    const uid = Number(userId);
    const cid = Number(courseId);
    const course = this.getCourseById(cid);
    if (!course) return;
    const totalLessons = this.countTotalLessons(course);
    if (totalLessons <= 0) return;

    const state = this.state$.value;
    const row = state.progress.find(p => p.userId === uid && p.courseId === cid) ?? null;
    if (!row) return;
    const completed = new Set((row.completedLessonIds || []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0));
    if (completed.size < totalLessons) return;
    if (row.state === 'COMPLETED') return;

    const now = new Date().toISOString();
    const progress = state.progress.map(p => {
      if (p.userId !== uid || p.courseId !== cid) return p;
      return { ...p, state: 'COMPLETED' as TrainingProgressState, completedAt: now, lastSeenAt: now };
    });
    this.commit({ ...state, progress });
  }

  private scoreQuiz(questions: TrainingQuizQuestion[], answers: number[]): number {
    if (!questions.length) return 0;
    let correct = 0;
    questions.forEach((q, idx) => {
      if (Number(answers[idx]) === Number(q.correctIndex)) correct += 1;
    });
    return Math.round((correct / questions.length) * 100);
  }

  private normalizeCourse(course: TrainingCourse): TrainingCourse {
    const now = new Date().toISOString();
    const safe: TrainingCourse = {
      ...course,
      id: Number(course.id),
      title: (course.title || '').toString().trim() || 'Untitled training',
      subtitle: (course.subtitle || '').toString(),
      description: (course.description || '').toString(),
      status: (course.status || 'DRAFT') as TrainingCourseStatus,
      tags: Array.isArray(course.tags) ? [...new Set(course.tags.map(t => String(t).trim()).filter(Boolean))] : [],
      difficulty: (course.difficulty || 'BEGINNER') as TrainingDifficulty,
      estimatedMinutes: Math.max(0, Number(course.estimatedMinutes || 0)),
      allowSelfEnroll: !!course.allowSelfEnroll,
      prerequisites: Array.isArray(course.prerequisites)
        ? [...new Set(course.prerequisites.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0))]
        : [],
      createdBy: Number.isFinite(Number(course.createdBy)) ? Number(course.createdBy) : 0,
      createdAt: (course.createdAt || now).toString(),
      updatedAt: now,
      publishedAt: course.publishedAt ?? null,
      archivedAt: course.archivedAt ?? null,
      version: Math.max(1, Number(course.version || 1)),
      modules: Array.isArray(course.modules) ? course.modules : []
    };

    safe.modules = safe.modules
      .map(m => ({
        ...m,
        title: (m.title || '').toString().trim() || 'Module',
        order: Number(m.order || 0),
        lessons: Array.isArray(m.lessons) ? m.lessons : []
      }))
      .sort((a, b) => a.order - b.order)
      .map((m, idx) => ({
        ...m,
        order: idx + 1,
        lessons: (m.lessons || [])
          .map(l => ({
            ...l,
            title: (l.title || '').toString().trim() || 'Lesson',
            order: Number(l.order || 0),
            type: (l.type || 'LESSON') as TrainingLessonType,
            contentMarkdown: (l.contentMarkdown || '').toString(),
            url: (l.url || '').toString(),
            quiz: l.type === 'QUIZ'
              ? {
                  passingScore: Math.min(100, Math.max(0, Number(l.quiz?.passingScore ?? 80))),
                  questions: Array.isArray(l.quiz?.questions) ? l.quiz!.questions : []
                }
              : undefined
          }))
          .sort((a, b) => a.order - b.order)
          .map((l, lidx) => ({ ...l, order: lidx + 1 }))
      }));

    return safe;
  }

  private deepCloneModules(modules: TrainingModule[]): TrainingModule[] {
    // Clone ids too; editor can later regenerate ids if needed.
    return (modules || []).map(m => ({
      ...m,
      lessons: (m.lessons || []).map(l => ({
        ...l,
        quiz: l.quiz
          ? {
              passingScore: l.quiz.passingScore,
              questions: (l.quiz.questions || []).map(q => ({ ...q, options: [...(q.options || [])] }))
            }
          : undefined
      }))
    }));
  }

    private commit(state: TrainingState): void {
    this.state$.next(this.normalizeState(state));
    this.schedulePersist();
  }

  private normalizeState(raw: Partial<TrainingState> | null | undefined): TrainingState {
    const parsed = raw as TrainingState | null | undefined;
    if (!parsed || !Array.isArray(parsed.courses) || !Array.isArray(parsed.assignments) || !Array.isArray(parsed.progress)) {
      return this.seedState();
    }

    const courses = parsed.courses.map(course => this.normalizeCourse(course as TrainingCourse));

    let maxCourseId = 0;
    let maxModuleId = 0;
    let maxLessonId = 0;
    let maxQuestionId = 0;
    for (const course of courses) {
      maxCourseId = Math.max(maxCourseId, Number(course.id || 0));
      for (const module of course.modules || []) {
        maxModuleId = Math.max(maxModuleId, Number(module.id || 0));
        for (const lesson of module.lessons || []) {
          maxLessonId = Math.max(maxLessonId, Number(lesson.id || 0));
          for (const question of lesson.quiz?.questions || []) {
            maxQuestionId = Math.max(maxQuestionId, Number(question.id || 0));
          }
        }
      }
    }

    const assignments = (parsed.assignments || [])
      .map(a => ({
        courseId: Number(a?.courseId || 0),
        userId: Number(a?.userId || 0),
        assignedBy: Number(a?.assignedBy || 0),
        assignedAt: (a?.assignedAt || '').toString(),
        dueAt: a?.dueAt ? a.dueAt.toString() : null,
        mandatory: !!a?.mandatory
      }))
      .filter(a => a.courseId > 0 && a.userId > 0);

    const progress = (parsed.progress || [])
      .map(p => ({
        courseId: Number(p?.courseId || 0),
        userId: Number(p?.userId || 0),
        state: ((p?.state || 'NOT_STARTED').toString().toUpperCase() as TrainingProgressState),
        startedAt: p?.startedAt ? p.startedAt.toString() : null,
        lastSeenAt: p?.lastSeenAt ? p.lastSeenAt.toString() : null,
        completedAt: p?.completedAt ? p.completedAt.toString() : null,
        completedLessonIds: [...new Set((Array.isArray(p?.completedLessonIds) ? p!.completedLessonIds : [])
          .map(v => Number(v))
          .filter(v => Number.isFinite(v) && v > 0))],
        quizAttemptsByLessonId: (p?.quizAttemptsByLessonId || {}) as Record<number, TrainingQuizAttempt[]>,
        timeSpentMsByLessonId: (p?.timeSpentMsByLessonId || {}) as Record<number, number>
      }))
      .filter(p => p.courseId > 0 && p.userId > 0);

    return {
      courses,
      assignments,
      progress,
      nextCourseId: Math.max(Number(parsed.nextCourseId || 0), maxCourseId + 1),
      nextModuleId: Math.max(Number(parsed.nextModuleId || 0), maxModuleId + 1),
      nextLessonId: Math.max(Number(parsed.nextLessonId || 0), maxLessonId + 1),
      nextQuestionId: Math.max(Number(parsed.nextQuestionId || 0), maxQuestionId + 1)
    };
  }

  private schedulePersist(): void {
    if (typeof window === 'undefined') return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistState();
    }, 250);
  }

  private persistState(): void {
    if (this.persistInFlight) {
      this.pendingPersist = true;
      return;
    }
    this.persistInFlight = true;
    const snapshot = this.normalizeState(this.state$.value);
    this.serverState.saveState(this.storageKey, snapshot).subscribe({
      next: () => {},
      error: () => {},
      complete: () => {
        this.persistInFlight = false;
        if (this.pendingPersist) {
          this.pendingPersist = false;
          this.schedulePersist();
        }
      }
    });
  }
  private seedState(): TrainingState {
    const now = new Date().toISOString();
    const c1: TrainingCourse = {
      id: 1,
      title: 'Focal Foundations',
      subtitle: 'How we operate support like a product team',
      description: 'Onboarding covering CRM workflow, tagging, and internal note etiquette.',
      status: 'PUBLISHED',
      tags: ['onboarding', 'crm', 'quality'],
      difficulty: 'BEGINNER',
      estimatedMinutes: 25,
      allowSelfEnroll: true,
      prerequisites: [],
      createdBy: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      archivedAt: null,
      version: 1,
      modules: [
        {
          id: 1,
          title: 'Welcome',
          order: 1,
          lessons: [
            {
              id: 1,
              title: 'What is Focal?',
              type: 'LESSON',
              order: 1,
              contentMarkdown:
                '# Focal\\n\\nFocal is a **Support OS**: CRM + Knowledge Base + Decision Trees.\\n\\nKey principles:\\n- One source of truth\\n- Fast navigation\\n- Notes are internal, emails are external\\n- Always tag cases\\n'
            },
            {
              id: 2,
              title: 'CRM Inbox Basics',
              type: 'LESSON',
              order: 2,
              contentMarkdown:
                '## CRM basics\\n\\n- Work from **My Playlist** or **My Cases**\\n- Use internal notes for context\\n- Keep the final reply short, precise, and human\\n'
            },
            {
              id: 3,
              title: 'Quiz: First response',
              type: 'QUIZ',
              order: 3,
              contentMarkdown: 'Take this quick quiz to confirm the basics.',
              quiz: {
                passingScore: 80,
                questions: [
                  {
                    id: 1,
                    prompt: 'Internal notes areâ€¦',
                    options: [
                      'Sent to the customer',
                      'Visible only to staff and not sent',
                      'Deleted after refresh',
                      'Only for managers'
                    ],
                    correctIndex: 1,
                    explanation: 'Internal notes are for staff context and are never sent to customers.'
                  },
                  {
                    id: 2,
                    prompt: 'Case tags should be appliedâ€¦',
                    options: ['Only when closing', 'Only when opening', 'As soon as you understand the issue', 'Never'],
                    correctIndex: 2
                  },
                  {
                    id: 3,
                    prompt: 'The best place to find the correct SOP isâ€¦',
                    options: ['Random memory', 'Knowledge Base + maps', 'Ask a friend', 'Ignore SOP'],
                    correctIndex: 1
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const c2: TrainingCourse = {
      id: 2,
      title: 'De-escalation Playbook',
      subtitle: 'Turn frustration into trust',
      description: 'A practical SOP for handling angry customers, delays, and high-risk cases.',
      status: 'PUBLISHED',
      tags: ['soft-skills', 'sop'],
      difficulty: 'INTERMEDIATE',
      estimatedMinutes: 18,
      allowSelfEnroll: true,
      prerequisites: [1],
      createdBy: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      archivedAt: null,
      version: 1,
      modules: [
        {
          id: 2,
          title: 'Core techniques',
          order: 1,
          lessons: [
            {
              id: 4,
              title: 'Acknowledge + Align + Action',
              type: 'LESSON',
              order: 1,
              contentMarkdown:
                '### Acknowledge\\n\\n- Validate feelings\\n\\n### Align\\n\\n- Show you are on their side\\n\\n### Action\\n\\n- Next steps + clear timeframe\\n'
            },
            {
              id: 5,
              title: 'Template library',
              type: 'LINK',
              order: 2,
              url: 'https://example.invalid/templates',
              contentMarkdown: 'Use templates as a base, but personalize the first sentence.'
            }
          ]
        }
      ]
    };

    const c3: TrainingCourse = {
      id: 3,
      title: 'Advanced Quality Calibration',
      subtitle: 'Consistency across agents and teams',
      description: 'Draft course used by QA and TLs to align scoring and coaching.',
      status: 'DRAFT',
      tags: ['qa', 'calibration'],
      difficulty: 'ADVANCED',
      estimatedMinutes: 30,
      allowSelfEnroll: false,
      prerequisites: [1],
      createdBy: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      archivedAt: null,
      version: 1,
      modules: []
    };

    return {
      nextCourseId: 4,
      nextModuleId: 3,
      nextLessonId: 6,
      nextQuestionId: 4,
      courses: [c3, c2, c1],
      assignments: [],
      progress: []
    };
  }
}

