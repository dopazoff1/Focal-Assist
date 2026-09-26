import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TrainingCourse, TrainingCourseStatus, TrainingDifficulty, TrainingService } from '../../services/training';

@Component({
  selector: 'app-training-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './training-catalog.html',
  styleUrls: ['./training-catalog.css']
})
export class TrainingCatalog {
  search = '';
  status: TrainingCourseStatus | 'ALL' = 'PUBLISHED';
  difficulty: TrainingDifficulty | 'ALL' = 'ALL';
  private readonly refresh$ = new BehaviorSubject<number>(0);

  readonly courses$: Observable<TrainingCourse[]>;

  constructor(
    public auth: AuthService,
    private training: TrainingService
  ) {
    this.courses$ = combineLatest([this.training.courses$, this.refresh$]).pipe(
      map(() => this.filterCourses())
    );
  }

  get canManageTraining(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS', 'OPS', 'TEAM_LEADER', 'QA');
  }

  setStatus(value: string): void {
    this.status = (value as any) || 'ALL';
    this.bump();
  }

  bump(): void {
    this.refresh$.next(this.refresh$.value + 1);
  }

  selfEnroll(courseId: number): void {
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid) return;
    this.training.selfEnroll(uid, courseId);
  }

  private filterCourses(): TrainingCourse[] {
    const uid = Number(this.auth.getUser()?.id || 0);
    const q = (this.search || '').trim().toLowerCase();
    const canSeeAll = this.canManageTraining;

    let rows = canSeeAll ? this.training.courses : this.training.listPublishedCourses();
    if (!canSeeAll && this.status !== 'ALL') {
      rows = rows.filter(c => c.status === 'PUBLISHED');
    }
    if (canSeeAll && this.status !== 'ALL') {
      rows = rows.filter(c => c.status === this.status);
    }
    if (this.difficulty !== 'ALL') {
      rows = rows.filter(c => c.difficulty === this.difficulty);
    }
    if (q) {
      rows = rows.filter(c => {
        const hay = `${c.title} ${c.subtitle} ${c.description} ${(c.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // Prefer published first for nicer UX.
    const rank: Record<TrainingCourseStatus, number> = { PUBLISHED: 0, DRAFT: 1, ARCHIVED: 2 };
    rows = [...rows].sort((a, b) => (rank[a.status] - rank[b.status]) || b.updatedAt.localeCompare(a.updatedAt));

    // Hide "enrolled" courses from top suggestions? keep them visible but can show badge.
    return rows.map(c => ({ ...c, allowSelfEnroll: !!c.allowSelfEnroll } as TrainingCourse));
  }

  isAssigned(courseId: number): boolean {
    const uid = Number(this.auth.getUser()?.id || 0);
    if (!uid) return false;
    return this.training.isUserAssigned(uid, courseId);
  }
}
