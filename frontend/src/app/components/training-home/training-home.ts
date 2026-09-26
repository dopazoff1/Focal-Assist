import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TrainingCourse, TrainingCourseSummary, TrainingService } from '../../services/training';

@Component({
  selector: 'app-training-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './training-home.html',
  styleUrls: ['./training-home.css']
})
export class TrainingHome {
  search = '';
  private readonly search$ = new BehaviorSubject<string>('');

  readonly myCourses$: Observable<TrainingCourseSummary[]>;
  readonly recommended$: Observable<TrainingCourse[]>;

  constructor(
    public auth: AuthService,
    private training: TrainingService
  ) {
    const uid = Number(this.auth.getUser()?.id || 0);

    this.myCourses$ = combineLatest([this.training.courses$, this.training.assignments$, this.training.progress$, this.search$]).pipe(
      map(() => this.training.listAssignedSummaries(uid)),
      map(rows => this.applySearch(rows, this.search$.value))
    );

    this.recommended$ = combineLatest([this.training.courses$, this.training.assignments$, this.search$]).pipe(
      map(() => this.pickRecommended(uid)),
      map(rows => this.applyRecommendedSearch(rows, this.search$.value))
    );
  }

  get canManageTraining(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS', 'OPS', 'TEAM_LEADER', 'QA');
  }

  get roleLabel(): string {
    return this.auth.getNormalizedRole() || 'USER';
  }

  selfEnroll(courseId: number): void {
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid) return;
    this.training.selfEnroll(uid, courseId);
  }

  onSearchChange(): void {
    this.search$.next((this.search || '').toString());
  }

  private pickRecommended(userId: number): TrainingCourse[] {
    const published = this.training.listPublishedCourses();
    return published
      .filter(c => c.allowSelfEnroll)
      .filter(c => !this.training.isUserAssigned(userId, c.id))
      .slice(0, 12);
  }

  private applySearch(rows: TrainingCourseSummary[], query: string): TrainingCourseSummary[] {
    const q = (query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const hay = `${r.course.title} ${r.course.subtitle} ${r.course.description} ${(r.course.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }

  private applyRecommendedSearch(rows: TrainingCourse[], query: string): TrainingCourse[] {
    const q = (query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(c => {
      const hay = `${c.title} ${c.subtitle} ${c.description} ${(c.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }
}
