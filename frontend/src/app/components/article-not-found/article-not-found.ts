import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-article-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './article-not-found.html',
  styleUrls: ['./article-not-found.css']
})
export class ArticleNotFoundComponent implements OnInit {
  articleId: number | null = null;
  source = '';

  constructor(private route: ActivatedRoute, private auth: AuthService) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.queryParamMap.get('article');
    const parsed = Number(rawId);
    this.articleId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    this.source = (this.route.snapshot.queryParamMap.get('from') || '').toString().trim();
  }

  get knowledgeBaseLink(): string {
    return this.auth.isLoggedIn() ? '/v3/knowledge-base' : '/knowledge-base-public';
  }

  get homeLink(): string {
    return this.auth.isLoggedIn() ? '/v3/home' : '/marketing';
  }
}

