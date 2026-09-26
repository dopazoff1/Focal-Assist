import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { combineLatest, map, Observable } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TrainingCourseSummary, TrainingService } from '../../services/training';

@Component({
  selector: 'app-training-certificate',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './training-certificate.html',
  styleUrls: ['./training-certificate.css']
})
export class TrainingCertificate implements OnInit {
  error = '';
  summary$?: Observable<TrainingCourseSummary | null>;

  constructor(
    public auth: AuthService,
    private training: TrainingService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const uid = Number(this.auth.getUser()?.id || 0);
    const cid = Number(this.route.snapshot.paramMap.get('id') || 0);
    if (!uid || !cid) {
      this.error = 'Invalid certificate link.';
      return;
    }
    this.summary$ = combineLatest([this.training.courses$, this.training.assignments$, this.training.progress$]).pipe(
      map(() => this.training.getCourseSummaryForUser(uid, cid))
    );
  }

  print(): void {
    if (typeof window === 'undefined') return;
    window.print();
  }
}

