import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { KbArticle, KbCategory, KbService } from '../../services/kb';

@Component({
  selector: 'app-article-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './article-management.html',
  styleUrls: ['./article-management.css']
})
export class ArticleManagement implements OnInit {
  categories: KbCategory[] = [];
  articles: KbArticle[] = [];
  filteredArticles: KbArticle[] = [];

  filterCategoryId: number | null = null;
  filterActive: 'all' | 'active' | 'inactive' = 'all';
  searchTerm = '';

  createCategoryId: number | null = null;
  createTitle = '';
  createContent = '<p></p>';
  createDisplayOrder = 0;
  creating = false;

  statusMessage = '';
  errorMessage = '';

  constructor(private kbService: KbService, private router: Router) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.errorMessage = '';
    this.statusMessage = '';

    this.kbService.getCategories().subscribe({
      next: categories => {
        this.categories = categories;
        if (!this.createCategoryId && categories.length > 0) {
          this.createCategoryId = categories[0].id;
        }
        if (!this.filterCategoryId && categories.length > 0) {
          this.filterCategoryId = categories[0].id;
        }
        this.loadAllArticles();
      },
      error: err => this.setError(err, 'Failed to load categories.')
    });
  }

  loadAllArticles(): void {
    this.kbService.getAllArticles().subscribe({
      next: articles => {
        this.articles = articles.map(a => ({
          ...a,
          categoryId: a.categoryId ?? a.category?.id
        }));
        this.applyFilters();
      },
      error: err => this.setError(err, 'Failed to load articles.')
    });
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredArticles = this.articles.filter(article => {
      const categoryOk = !this.filterCategoryId || article.categoryId === this.filterCategoryId;
      const activeOk =
        this.filterActive === 'all' ||
        (this.filterActive === 'active' && article.isActive !== false) ||
        (this.filterActive === 'inactive' && article.isActive === false);
      const termOk = !term || article.title.toLowerCase().includes(term);
      return categoryOk && activeOk && termOk;
    });
  }

  createArticle(): void {
    this.errorMessage = '';
    this.statusMessage = '';
    const categoryId = this.createCategoryId;
    const title = this.createTitle.trim();

    if (!categoryId) {
      this.errorMessage = 'Select a category.';
      return;
    }
    if (!title) {
      this.errorMessage = 'Title is required.';
      return;
    }

    this.creating = true;
    this.kbService.createArticle({
      categoryId,
      title,
      content: this.createContent || '<p></p>',
      displayOrder: this.createDisplayOrder ?? 0,
      isActive: true
    }).subscribe({
      next: created => {
        this.creating = false;
        this.createTitle = '';
        this.createContent = '<p></p>';
        this.createDisplayOrder = 0;
        this.statusMessage = `Article "${created.title}" created.`;
        this.loadAllArticles();
      },
      error: err => {
        this.creating = false;
        this.setError(err, 'Failed to create article.');
      }
    });
  }

  toggleActive(article: KbArticle): void {
    const nextValue = !(article.isActive !== false);
    this.kbService.setArticleActive(article.id, nextValue).subscribe({
      next: updated => {
        this.statusMessage = `Article "${updated.title}" ${nextValue ? 'activated' : 'deactivated'}.`;
        this.loadAllArticles();
      },
      error: err => this.setError(err, 'Failed to change article status.')
    });
  }

  duplicateArticle(article: KbArticle): void {
    this.kbService.duplicateArticle(article.id).subscribe({
      next: created => {
        this.statusMessage = `Article duplicated: "${created.title}".`;
        this.loadAllArticles();
      },
      error: err => this.setError(err, 'Failed to duplicate article.')
    });
  }

  deleteArticle(article: KbArticle): void {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`Delete article "${article.title}" permanently?`);
      if (!ok) return;
    }

    this.kbService.deleteArticle(article.id).subscribe({
      next: () => {
        this.statusMessage = `Article "${article.title}" deleted.`;
        this.loadAllArticles();
      },
      error: err => this.setError(err, 'Failed to delete article.')
    });
  }

  goToEdit(article: KbArticle): void {
    void this.router.navigate(['/article-management/edit', article.id]);
  }

  openInKnowledgeBase(article: KbArticle): void {
    void this.router.navigate(['/knowledge-base'], {
      queryParams: { article: article.id }
    });
  }

  openMapBuilder(): void {
    void this.router.navigate(['/kb-map-builder']);
  }

  private setError(err: unknown, fallback: string): void {
    const httpError = err as HttpErrorResponse;
    this.errorMessage =
      httpError?.error?.message ||
      httpError?.message ||
      fallback;
  }
}
