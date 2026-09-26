import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { EditorModule, TINYMCE_SCRIPT_SRC } from '@tinymce/tinymce-angular';
import { KbArticle, KbArticleDraft, KbCategory, KbService, KbValidationComment } from '../../services/kb';
import { createfocalRichEditorInit } from '../../utils/rich-editor-config';
import { MermaidContentDirective } from '../../directives/mermaid-content';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-article-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, EditorModule, MermaidContentDirective],
  providers: [
    { provide: TINYMCE_SCRIPT_SRC, useValue: '/tinymce/tinymce.min.js' }
  ],
  templateUrl: './article-editor.html',
  styleUrls: ['./article-editor.css']
})
export class ArticleEditor implements OnInit {
  articleId: number | null = null;
  article: KbArticle | null = null;
  categories: KbCategory[] = [];

  categoryId: number | null = null;
  title = '';
  content = '';
  displayOrder = 0;
  isActive = true;
  draftId: number | null = null;
  draftStatus: KbArticleDraft['status'] | null = null;
  reviewComments: KbValidationComment[] = [];

  loading = false;
  saving = false;
  deleting = false;
  showPreview = false;
  showHtmlSource = false;
  metadataCollapsed = false;
  editorMode: 'visual' | 'flowchart' | 'source' = 'visual';
  flowchartSource = `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]`;
  statusMessage = '';
  errorMessage = '';

  readonly editorInit = createfocalRichEditorInit(560);

  constructor(
    private kbService: KbService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.goToArticleNotFound(id);
      return;
    }

    this.articleId = id;
    this.loadData();
  }

  save(onSaved?: () => void): void {
    if (!this.articleId) return;

    const title = this.title.trim();
    if (!this.categoryId) {
      this.errorMessage = 'Select a category.';
      return;
    }
    if (!title) {
      this.errorMessage = 'Title is required.';
      return;
    }

    this.errorMessage = '';
    this.statusMessage = '';
    this.saving = true;

    this.kbService.saveArticleDraft(this.articleId, {
      categoryId: this.categoryId,
      title,
      content: this.getNormalizedEditorHtml(),
      displayOrder: this.displayOrder ?? 0,
      requestedActive: this.isActive,
    }).subscribe({
      next: draft => {
        this.saving = false;
        this.applyDraft(draft);
        this.statusMessage = `Draft saved. It is not published until validation is complete.`;
        onSaved?.();
      },
      error: err => {
        this.saving = false;
        this.setError(err, 'Failed to save article.');
      }
    });
  }

  submitForValidation(): void {
    if (!this.articleId) return;
    this.save(() => {
      if (!this.draftId) return;
      this.kbService.submitArticleRevision(this.draftId).subscribe({
        next: draft => {
          this.applyDraft(draft);
          this.statusMessage = 'Submitted to the validation queue.';
        },
        error: err => this.setError(err, 'Failed to submit draft for validation.')
      });
    });
  }

  toggleActive(): void {
    if (!this.articleId || !this.article) return;
    const nextValue = !this.isActive;
    if (nextValue) {
      this.errorMessage = 'Articles are published by validation approval. Submit the draft instead.';
      return;
    }
    this.kbService.setArticleActive(this.articleId, nextValue).subscribe({
      next: updated => {
        this.article = {
          ...updated,
          categoryId: updated.categoryId ?? updated.category?.id
        };
        this.fillForm(this.article);
        this.statusMessage = `Article "${updated.title}" ${nextValue ? 'activated' : 'deactivated'}.`;
      },
      error: err => this.setError(err, 'Failed to change article status.')
    });
  }

  duplicate(): void {
    if (!this.articleId) return;
    this.kbService.duplicateArticle(this.articleId).subscribe({
      next: created => {
        this.statusMessage = `Article duplicated: "${created.title}".`;
      },
      error: err => this.setError(err, 'Failed to duplicate article.')
    });
  }

  delete(): void {
    if (!this.articleId || !this.article) return;

    if (typeof window !== 'undefined') {
      const ok = window.confirm(`Delete article "${this.article.title}" permanently?`);
      if (!ok) return;
    }

    this.deleting = true;
    this.kbService.deleteArticle(this.articleId).subscribe({
      next: () => {
        this.deleting = false;
        void this.router.navigate([`${this.shellBase}/article-management`]);
      },
      error: err => {
        this.deleting = false;
        this.setError(err, 'Failed to delete article.');
      }
    });
  }

  goBackToManagement(): void {
    void this.router.navigate([`${this.shellBase}/article-management`]);
  }

  openMapBuilder(): void {
    void this.router.navigate([`${this.shellBase}/kb-map-builder`]);
  }

  onEditorContentChange(value: string): void {
    this.content = (value || '').toString();
  }

  setEditorMode(mode: 'visual' | 'flowchart' | 'source'): void {
    this.editorMode = mode;
    if (mode === 'flowchart') {
      this.showPreview = false;
    }
  }

  insertFlowchartIntoArticle(): void {
    const source = this.flowchartSource.trim();
    if (!source) return;
    const encoded = this.escapeHtml(source);
    const block = `<pre class="mermaid">${encoded}</pre><p><br></p>`;
    this.content = `${this.content.trim()}${this.content.trim() ? '<p><br></p>' : ''}${block}`;
    this.editorMode = 'visual';
    this.statusMessage = 'Flowchart inserted into the article body.';
  }

  setHtmlSource(value: string): void {
    this.content = value || '';
  }

  get wordCount(): number {
    const text = this.stripHtml(this.content || '').trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  }

  private loadData(): void {
    if (!this.articleId) return;

    this.loading = true;
    this.errorMessage = '';
    this.statusMessage = '';

    forkJoin({
      categories: this.kbService.getCategories(),
      draft: this.kbService.getArticleDraft(this.articleId)
    }).subscribe({
      next: ({ categories, draft }) => {
        this.categories = categories;
        this.applyDraft(draft);
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        const httpError = err as HttpErrorResponse;
        if (httpError?.status === 404) {
          this.goToArticleNotFound(this.articleId || undefined);
          return;
        }
        this.setError(err, 'Failed to load article workspace.');
      }
    });
  }

  private applyDraft(draft: KbArticleDraft): void {
    this.draftId = draft.revisionId ?? null;
    this.draftStatus = draft.status ?? null;
    this.reviewComments = draft.comments || [];
    this.article = {
      id: draft.articleId,
      title: draft.title,
      content: draft.content || '<p></p>',
      categoryId: draft.categoryId,
      category: draft.categoryId ? { id: draft.categoryId, name: draft.categoryName } : undefined,
      displayOrder: draft.displayOrder,
      isActive: draft.requestedActive
    };
    this.fillForm(this.article);
    this.isActive = draft.requestedActive;
  }

  private fillForm(article: KbArticle): void {
    this.categoryId = article.categoryId ?? article.category?.id ?? null;
    this.title = article.title;
    this.content = article.content || '<p></p>';
    this.displayOrder = article.displayOrder ?? 0;
    this.isActive = article.isActive !== false;
  }

  private setError(err: unknown, fallback: string): void {
    const httpError = err as HttpErrorResponse;
    this.errorMessage = httpError?.error?.message || httpError?.message || fallback;
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]+>/g, ' ');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getNormalizedEditorHtml(): string {
    const html = (this.content || '').trim();
    if (!html || html === '<br>') {
      return '<p></p>';
    }
    return html;
  }

  private get shellBase(): '/v3' {
    return '/v3';
  }

  private goToArticleNotFound(articleId?: number): void {
    const parsed = Number(articleId);
    const validId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    void this.router.navigate(['/v3/article-not-found'], {
      queryParams: {
        article: validId ?? undefined,
        from: 'article-editor'
      }
    });
  }
}
