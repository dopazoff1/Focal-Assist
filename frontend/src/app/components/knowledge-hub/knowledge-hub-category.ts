import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideArrowLeft, LucideArrowRight, LucideArrowUpRight, LucideBookOpen } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { KnowledgeHubArticleSummary, KnowledgeHubIndex, KnowledgeHubService } from '../../services/knowledge-hub';

@Component({
  selector: 'app-knowledge-hub-category',
  standalone: true,
  imports: [CommonModule, LucideArrowLeft, LucideArrowRight, LucideArrowUpRight, LucideBookOpen],
  templateUrl: './knowledge-hub-category.html',
  styleUrls: ['./knowledge-hub.css']
})
export class KnowledgeHubCategoryComponent implements OnInit, OnDestroy {
  index: KnowledgeHubIndex = { categories: [], articles: [] };
  articles: KnowledgeHubArticleSummary[] = [];
  categoryName = 'Category';
  loading = true;
  private routeSub?: Subscription;

  constructor(
    private hubService: KnowledgeHubService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const categoryId = Number(params.get('categoryId'));
      this.hubService.loadIndex().subscribe({
        next: index => {
          this.index = index;
          const category = index.categories.find(item => item.id === categoryId);
          this.categoryName = category?.name || 'Category not found';
          this.articles = index.articles.filter(article => article.categoryId === categoryId);
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  backToHub(): void {
    void this.router.navigate(['/v3/knowledge-hub']);
  }

  openArticle(articleId: number): void {
    void this.router.navigate(['/v3/knowledge-hub/article', articleId]);
  }
}
