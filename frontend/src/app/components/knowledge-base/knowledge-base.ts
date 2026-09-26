import { Component, OnInit, ChangeDetectorRef, HostListener, AfterViewInit, OnDestroy, ViewChild, ViewChildren, ElementRef, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KbService, KbCategory, KbArticle, KbArticleMap, KbMapNode, KbMapEdge } from '../../services/kb';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MermaidContentDirective } from '../../directives/mermaid-content';

interface KbMapViewChoice {
  id: string;
  label: string;
  targetNodeId: string | null;
  targetTitle: string;
}

interface KbMapViewNode {
  id: string;
  title: string;
  content: string;
  hasInfo: boolean;
  isStart: boolean;
  x: number;
  y: number;
  choices: KbMapViewChoice[];
}

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MermaidContentDirective],
  templateUrl: './knowledge-base.html',
  styleUrls: ['./knowledge-base.css']
})
export class KnowledgeBase implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapCanvasRef') mapCanvasRef?: ElementRef<HTMLDivElement>;
  @ViewChild('mapWorldRef') mapWorldRef?: ElementRef<HTMLDivElement>;
  @ViewChild('stepCloseButton') stepCloseButton?: ElementRef<HTMLButtonElement>;
  @ViewChildren('mapNodeRef') mapNodeRefs?: QueryList<ElementRef<HTMLElement>>;

  viewMode: 'content' | 'map' = 'content';

  categories: KbCategory[] = [];
  articlesMap: { [key: number]: KbArticle[] } = {};
  selectedArticle?: KbArticle;
  searchTerm = '';
  loading = false;
  private requestedArticleId: number | null = null;

  mapNodes: KbMapViewNode[] = [];
  selectedMapNode: KbMapViewNode | null = null;
  private lastMapFocus: HTMLElement | null = null;

  articleMapExists: Record<number, boolean> = {};
  private articleMaps: Record<number, KbArticleMap> = {};
  mapLoading = false;
  mapError = '';
  feedbackBubbleOpen = false;
  feedbackDraftSentiment: 'LIKE' | 'DISLIKE' | null = null;
  feedbackDraftComment = '';
  feedbackSubmitting = false;
  feedbackInfo = '';
  feedbackInfoTone: 'success' | 'error' | '' = '';
  private mapNodeChangesSub?: Subscription;
  isPanningMap = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  mapPanX = 0;
  mapPanY = 0;

  private readonly kbTrackSource = 'v3_knowledge_base';
  private readonly kbTrackHeartbeatMs = 15000;
  private kbTrackSessionId = '';
  private kbTrackStartedAtMs = 0;
  private kbTrackArticleId: number | null = null;
  private kbTrackTimer: number | null = null;

  constructor(
    private kbService: KbService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.kbTrackSessionId = this.buildTrackSessionId();
    this.startTrackHeartbeat();

    this.route.queryParamMap.subscribe(params => {
      const rawId = params.get('article');
      const parsedId = rawId ? Number(rawId) : NaN;
      this.requestedArticleId = Number.isFinite(parsedId) ? parsedId : null;

      if (params.has('q')) {
        this.searchTerm = (params.get('q') || '').toString();
      }

      if (this.requestedArticleId === null) {
        this.flushTrackedTime();
        this.kbTrackArticleId = null;
        this.kbTrackStartedAtMs = 0;
        this.selectedArticle = undefined;
      } else {
        const matched = this.trySelectRequestedArticle();
        if (!matched && this.categories.length > 0 && Object.keys(this.articlesMap).length > 0) {
          this.goToArticleNotFound(this.requestedArticleId);
        }
      }
    });

    this.loadCategoriesAndArticles();
  }

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
    this.mapNodeChangesSub = this.mapNodeRefs?.changes.subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.mapNodeChangesSub?.unsubscribe();
    this.stopTrackHeartbeat();
    this.flushTrackedTime();
  }

  private loadCategoriesAndArticles(): void {
    this.loading = true;
    this.kbService.getCategories().subscribe({
      next: categories => {
        this.categories = categories;
        const requests = categories.map(cat => this.kbService.getArticlesByCategory(cat.id));
        if (!requests.length) {
          this.articlesMap = {};
          if (this.requestedArticleId !== null) {
            const matched = this.trySelectRequestedArticle();
            if (!matched) {
              this.loading = false;
              this.goToArticleNotFound(this.requestedArticleId);
              this.cdr.detectChanges();
              return;
            }
          }
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }
        forkJoin(requests).subscribe({
          next: grouped => {
            this.articlesMap = {};
            categories.forEach((cat, idx) => {
              const articles = grouped[idx] || [];
              this.articlesMap[cat.id] = articles;
              for (const article of articles) {
                this.probeArticleMap(article.id);
              }
            });
            if (this.requestedArticleId !== null) {
              const matched = this.trySelectRequestedArticle();
              if (!matched) {
                this.loading = false;
                this.goToArticleNotFound(this.requestedArticleId);
                this.cdr.detectChanges();
                return;
              }
            }
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.articlesMap = {};
            this.loading = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get visibleCategories(): KbCategory[] {
    return this.categories.filter(category => this.getFilteredArticles(category.id).length > 0);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge'
    });
  }

  private trySelectRequestedArticle(): boolean {
    if (this.requestedArticleId === null) return false;

    for (const articles of Object.values(this.articlesMap)) {
      const match = articles.find(a => a.id === this.requestedArticleId);
      if (match) {
        this.selectArticle(match, false);
        return true;
      }
    }
    return false;
  }

  selectArticle(article: KbArticle, updateUrl = true): void {
    this.flushTrackedTime();
    this.kbTrackArticleId = article.id;
    this.kbTrackStartedAtMs = Date.now();

    this.selectedArticle = article;
    this.viewMode = 'content';
    this.mapNodes = [];
    this.selectedMapNode = null;
    this.mapError = '';
    this.clearFeedbackState();

    this.probeArticleMap(article.id);

    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { article: article.id },
        queryParamsHandling: 'merge'
      });
    }
  }

  getFilteredArticles(categoryId: number): KbArticle[] {
    const articles = this.articlesMap[categoryId] || [];
    if (!this.searchTerm) return articles;

    const term = this.searchTerm.toLowerCase();
    return articles.filter(a => a.title.toLowerCase().includes(term));
  }

  getShareUrl(article: KbArticle): string {
    if (typeof window === 'undefined') return '';

    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { article: article.id },
      queryParamsHandling: 'merge'
    });

    return `${window.location.origin}${this.router.serializeUrl(tree)}`;
  }

  copyShareUrl(article: KbArticle): void {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(this.getShareUrl(article));
  }

  showContentView(): void {
    this.viewMode = 'content';
    this.selectedMapNode = null;
  }

  openFeedbackBubble(sentiment: 'LIKE' | 'DISLIKE'): void {
    if (!this.selectedArticle) return;

    this.feedbackInfo = '';
    this.feedbackInfoTone = '';
    this.feedbackDraftSentiment = sentiment;
    this.feedbackBubbleOpen = true;
    this.feedbackDraftComment = '';
  }

  cancelFeedbackBubble(): void {
    this.feedbackBubbleOpen = false;
    this.feedbackDraftSentiment = null;
    this.feedbackDraftComment = '';
    this.feedbackSubmitting = false;
  }

  submitFeedback(): void {
    if (!this.selectedArticle || !this.feedbackDraftSentiment || this.feedbackSubmitting) {
      return;
    }

    this.feedbackSubmitting = true;
    const comment = this.feedbackDraftComment.trim();

    this.kbService.submitArticleFeedback(this.selectedArticle.id, {
      sentiment: this.feedbackDraftSentiment,
      feedbackText: comment.length ? comment : undefined
    }).subscribe({
      next: () => {
        this.feedbackSubmitting = false;
        this.feedbackBubbleOpen = false;
        this.feedbackDraftSentiment = null;
        this.feedbackDraftComment = '';
        this.feedbackInfo = 'Thanks, your feedback was saved.';
        this.feedbackInfoTone = 'success';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.feedbackSubmitting = false;
        const apiMessage = err?.error?.message || err?.message || 'Could not submit feedback.';
        this.feedbackInfo = apiMessage;
        this.feedbackInfoTone = 'error';
        this.cdr.detectChanges();
      }
    });
  }

  showMapView(): void {
    if (!this.selectedArticle) return;
    this.mapError = '';
    this.selectedMapNode = null;
    this.ensureArticleMap(this.selectedArticle.id, true);
  }

  hasMap(articleId: number | undefined): boolean {
    if (!articleId) return false;
    return this.articleMapExists[articleId] === true;
  }

  onMapNodeClick(nodeId: string): void {
    if (this.isPanningMap) return;
    const node = this.findMapNodeById(nodeId);
    if (!node) return;
    if (!node.hasInfo) return;
    this.openStepOverlay(node);
  }

  onMapNodeKeydown(node: KbMapViewNode, event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
    keyboardEvent.preventDefault();
    if (node.hasInfo) {
      this.openStepOverlay(node);
    }
  }

  onMapChoiceClick(sourceNodeId: string, choice: KbMapViewChoice, event: MouseEvent): void {
    event.stopPropagation();

    if (choice.targetNodeId) {
      const target = this.findMapNodeById(choice.targetNodeId);
      if (target && target.hasInfo) {
        this.openStepOverlay(target);
        return;
      }
    }

    const source = this.findMapNodeById(sourceNodeId);
    if (source && source.hasInfo) {
      this.openStepOverlay(source);
    }
  }

  openStepOverlay(node: KbMapViewNode): void {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      this.lastMapFocus = document.activeElement;
    }
    this.selectedMapNode = node;
    this.cdr.detectChanges();
    window.setTimeout(() => this.stepCloseButton?.nativeElement.focus(), 0);
  }

  closeStepOverlay(): void {
    this.selectedMapNode = null;
    this.cdr.detectChanges();
    window.setTimeout(() => {
      if (this.lastMapFocus?.isConnected) {
        this.lastMapFocus.focus();
      }
      this.lastMapFocus = null;
    }, 0);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.selectedMapNode) {
      this.closeStepOverlay();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDrawerTab(event: KeyboardEvent): void {
    if (!this.selectedMapNode || event.key !== 'Tab' || typeof document === 'undefined') return;

    const drawer = document.querySelector<HTMLElement>('.kb-step-drawer');
    if (!drawer) return;
    const focusable = Array.from(drawer.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(element => !element.hasAttribute('disabled') && element.offsetParent !== null);
    if (!focusable.length) return;

    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusable[nextIndex].focus();
  }

  getMapChoiceConnectionPath(
    sourceNodeId: string,
    choiceIndex: number,
    targetNodeId: string | null
  ): string {
    if (!targetNodeId) return '';

    const source = this.findMapNodeById(sourceNodeId);
    const target = this.findMapNodeById(targetNodeId);
    if (!source || !target) return '';

    const sourceAnchor = this.getNodeAnchor(source.id, 'right');
    const targetAnchor = this.getNodeAnchor(target.id, 'left');
    const spread = 14;
    const centerOffset = (source.choices.length - 1) / 2;
    const startX = sourceAnchor.x;
    const startY = sourceAnchor.y + (choiceIndex - centerOffset) * spread;
    const endX = targetAnchor.x;
    const endY = targetAnchor.y;
    const controlOffset = Math.max(60, Math.abs(endX - startX) * 0.35);
    const c1x = startX + controlOffset;
    const c2x = endX - controlOffset;

    return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`;
  }

  getMapWorldTransform(): string {
    return `translate(${this.mapPanX}px, ${this.mapPanY}px)`;
  }

  onMapCanvasMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.kb-map-node-card')) {
      return;
    }

    this.isPanningMap = true;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panOriginX = this.mapPanX;
    this.panOriginY = this.mapPanY;
    event.preventDefault();
  }

  onMapCanvasMouseMove(event: MouseEvent): void {
    if (!this.isPanningMap) return;
    this.mapPanX = this.panOriginX + (event.clientX - this.panStartX);
    this.mapPanY = this.panOriginY + (event.clientY - this.panStartY);
    this.cdr.detectChanges();
  }

  onMapCanvasMouseUp(): void {
    this.isPanningMap = false;
  }

  getMapWorldWidth(): number {
    if (!this.mapNodes.length) return 1200;
    const maxRight = Math.max(...this.mapNodes.map(node => node.x + 420));
    return Math.max(1200, maxRight);
  }

  getMapWorldHeight(): number {
    if (!this.mapNodes.length) return 900;
    const maxBottom = Math.max(...this.mapNodes.map(node => node.y + this.getMapNodeHeight(node)));
    return Math.max(900, maxBottom + 140);
  }

  getMapNodePreview(content: string): string {
    const plain = (content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) return '';
    if (plain.length <= 110) return plain;
    return `${plain.slice(0, 107)}...`;
  }

  getStepOverlayContent(node: KbMapViewNode): string {
    const html = (node.content || '').trim();
    if (html) {
      return html;
    }
    return '<p>No details were added for this step yet.</p>';
  }

  private probeArticleMap(articleId: number): void {
    if (articleId in this.articleMapExists) return;

    this.kbService.getArticleMap(articleId).subscribe({
      next: map => {
        const exists = !!map && Array.isArray(map.nodes) && map.nodes.length > 0;
        this.articleMapExists[articleId] = exists;
        if (exists) {
          this.articleMaps[articleId] = map;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.articleMapExists[articleId] = false;
        this.cdr.detectChanges();
      }
    });
  }

  private ensureArticleMap(articleId: number, renderOnReady: boolean): void {
    if (this.articleMaps[articleId]) {
      if (renderOnReady && this.selectedArticle) {
        this.viewMode = 'map';
        this.buildArticleMap(this.articleMaps[articleId]);
      }
      return;
    }

    this.mapLoading = true;
    this.kbService.getArticleMap(articleId).subscribe({
      next: map => {
        this.mapLoading = false;
        const exists = !!map && Array.isArray(map.nodes) && map.nodes.length > 0;
        this.articleMapExists[articleId] = exists;

        if (!exists) {
          if (renderOnReady) {
            this.viewMode = 'content';
            this.mapError = 'No map is configured for this article yet.';
          }
          this.cdr.detectChanges();
          return;
        }

        this.articleMaps[articleId] = map;
        if (renderOnReady) {
          this.viewMode = 'map';
          this.buildArticleMap(map);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.mapLoading = false;
        this.articleMapExists[articleId] = false;
        if (renderOnReady) {
          this.viewMode = 'content';
          this.mapError = 'Failed to load article map from backend.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  private buildArticleMap(map: KbArticleMap): void {
    const nodes = Array.isArray(map.nodes) ? map.nodes : [];
    const mapEdges = Array.isArray(map.edges) ? map.edges : [];
    const edges = mapEdges.length > 0 ? mapEdges : this.extractEdgesFromNodeChoices(nodes);
    const edgesBySource = this.groupEdgesBySource(edges);
    const nodeLookup = new Map<string, KbMapNode>(
      nodes.map(node => [this.normalizeMapId(node.id), node])
    );
    const hasAnyPosition = nodes.some(n => this.getNodeX(n) !== null || this.getNodeY(n) !== null);

    const uiNodes = nodes.map((node, index) => {
      const id = this.normalizeMapId(node.id);
      const title = (node.title || node.label || `Step ${node.id}`).trim();
      const content = (node.content || '').trim();
      const rawX = this.getNodeX(node);
      const rawY = this.getNodeY(node);
      const x = hasAnyPosition ? (rawX ?? this.defaultNodeX(index)) : this.defaultNodeX(index);
      const y = hasAnyPosition ? (rawY ?? this.defaultNodeY(index)) : this.defaultNodeY(index);
      const sourceEdges = edgesBySource.get(id) || [];
      const choices = sourceEdges.map((edge, edgeIndex) => this.toViewChoice(edge, edgeIndex, nodeLookup));

      return {
        id,
        title,
        content,
        hasInfo: this.hasMeaningfulContent(content),
        isStart: !!node.isStart,
        x: Number.isFinite(x) ? x : this.defaultNodeX(index),
        y: Number.isFinite(y) ? y : this.defaultNodeY(index),
        choices
      } as KbMapViewNode;
    });

    if (uiNodes.length && !uiNodes.some(node => node.isStart)) {
      uiNodes[0].isStart = true;
    }

    this.mapNodes = this.layoutNodesHorizontally(uiNodes);
    this.selectedMapNode = null;
    this.centerMapOnStartNode();
  }

  private getNodeX(node: KbMapNode): number | null {
    const x = typeof node.xPos === 'number' ? node.xPos : node.x;
    return typeof x === 'number' ? x : null;
  }

  private getNodeY(node: KbMapNode): number | null {
    const y = typeof node.yPos === 'number' ? node.yPos : node.y;
    return typeof y === 'number' ? y : null;
  }

  private defaultNodeX(index: number): number {
    const column = index % 3;
    return 40 + column * 360;
  }

  private defaultNodeY(index: number): number {
    const row = Math.floor(index / 3);
    return 40 + row * 220;
  }

  private getNodeAnchor(nodeId: string, side: 'left' | 'right'): { x: number; y: number } {
    const worldRect = this.mapWorldRef?.nativeElement.getBoundingClientRect();
    const nodeRef = this.mapNodeRefs?.find(ref =>
      this.normalizeMapId(ref.nativeElement.dataset['nodeId']) === this.normalizeMapId(nodeId)
    );

    if (worldRect && nodeRef) {
      const rect = nodeRef.nativeElement.getBoundingClientRect();
      return {
        x: side === 'right' ? rect.right - worldRect.left : rect.left - worldRect.left,
        y: rect.top - worldRect.top + (rect.height / 2)
      };
    }

    const node = this.findMapNodeById(nodeId);
    if (!node) {
      return { x: 0, y: 0 };
    }
    const fallbackCenterY = node.y + (this.getMapNodeHeight(node) / 2);
    return {
      x: side === 'right' ? node.x + 296 : node.x,
      y: fallbackCenterY
    };
  }

  private getMapNodeHeight(node: KbMapViewNode): number {
    return 84;
  }

  private layoutNodesHorizontally(nodes: KbMapViewNode[]): KbMapViewNode[] {
    if (!nodes.length) return [];

    const nodeById = new Map(nodes.map(node => [node.id, { ...node }]));
    const levels = new Map<string, number>();
    const incoming = new Map<string, string[]>();
    const orderedNodes = Array.from(nodeById.values());

    for (const node of orderedNodes) {
      incoming.set(node.id, []);
    }

    for (const node of orderedNodes) {
      for (const choice of node.choices) {
        const targetId = this.normalizeMapId(choice.targetNodeId);
        if (!targetId || !nodeById.has(targetId)) continue;
        const parents = incoming.get(targetId) || [];
        parents.push(node.id);
        incoming.set(targetId, parents);
      }
    }

    const startNodes = orderedNodes.filter(node => node.isStart);
    const roots = startNodes.length > 0
      ? startNodes
      : orderedNodes.filter(node => (incoming.get(node.id) || []).length === 0);
    const queue: string[] = (roots.length > 0 ? roots : [orderedNodes[0]]).map(node => node.id);

    for (const rootId of queue) {
      levels.set(rootId, 0);
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = nodeById.get(currentId);
      if (!currentNode) continue;
      const currentLevel = levels.get(currentId) ?? 0;

      for (const choice of currentNode.choices) {
        const targetId = this.normalizeMapId(choice.targetNodeId);
        if (!targetId || !nodeById.has(targetId)) continue;
        const nextLevel = currentLevel + 1;
        const existing = levels.get(targetId);
        if (existing === undefined || nextLevel < existing) {
          levels.set(targetId, nextLevel);
          queue.push(targetId);
        }
      }
    }

    let maxLevel = Math.max(0, ...Array.from(levels.values()));
    for (const node of orderedNodes) {
      if (!levels.has(node.id)) {
        maxLevel += 1;
        levels.set(node.id, maxLevel);
      }
    }

    const nodesByLevel = new Map<number, KbMapViewNode[]>();
    for (const node of orderedNodes) {
      const level = levels.get(node.id) ?? 0;
      const levelNodes = nodesByLevel.get(level) || [];
      levelNodes.push(node);
      nodesByLevel.set(level, levelNodes);
    }

    const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);
    const prevLevelOrder = new Map<string, number>();

    for (const level of sortedLevels) {
      const levelNodes = nodesByLevel.get(level)!;
      levelNodes.sort((a, b) => {
        if (level === 0) {
          if (a.isStart !== b.isStart) return a.isStart ? -1 : 1;
          return a.id.localeCompare(b.id, undefined, { numeric: true });
        }
        const aParents = incoming.get(a.id) || [];
        const bParents = incoming.get(b.id) || [];
        const aKey = this.averageParentOrder(aParents, prevLevelOrder);
        const bKey = this.averageParentOrder(bParents, prevLevelOrder);
        if (aKey !== bKey) return aKey - bKey;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });

      levelNodes.forEach((node, index) => prevLevelOrder.set(node.id, index));
    }

    const horizontalGap = 420;
    const verticalGap = 150;
    const baseX = 120;
    const baseY = 260;

    for (const level of sortedLevels) {
      const levelNodes = nodesByLevel.get(level)!;
      const blockHeight = (levelNodes.length - 1) * verticalGap;
      levelNodes.forEach((node, idx) => {
        node.x = baseX + level * horizontalGap;
        node.y = baseY + idx * verticalGap - (blockHeight / 2);
      });
    }

    return orderedNodes;
  }

  private averageParentOrder(parentIds: string[], orderMap: Map<string, number>): number {
    if (parentIds.length === 0) return Number.MAX_SAFE_INTEGER / 2;
    let total = 0;
    let count = 0;
    for (const parentId of parentIds) {
      const value = orderMap.get(parentId);
      if (typeof value === 'number') {
        total += value;
        count += 1;
      }
    }
    if (count === 0) return Number.MAX_SAFE_INTEGER / 2;
    return total / count;
  }

  private hasMeaningfulContent(content: string): boolean {
    return this.stripHtml(content).length > 0;
  }

  private stripHtml(input: string): string {
    return (input || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private centerMapOnStartNode(): void {
    const startNode = this.mapNodes.find(node => node.isStart) || this.mapNodes[0];
    if (!startNode) {
      this.mapPanX = 0;
      this.mapPanY = 0;
      return;
    }

    const center = () => {
      const canvas = this.mapCanvasRef?.nativeElement;
      if (!canvas) return;
      const nodeWidth = 296;
      const nodeHeight = this.getMapNodeHeight(startNode);
      const nodeCenterX = startNode.x + (nodeWidth / 2);
      const nodeCenterY = startNode.y + (nodeHeight / 2);
      this.mapPanX = (canvas.clientWidth / 2) - nodeCenterX;
      this.mapPanY = (canvas.clientHeight / 2) - nodeCenterY;
      this.cdr.detectChanges();
    };

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(center);
      });
      return;
    }

    center();
  }

  private groupEdgesBySource(edges: KbMapEdge[]): Map<string, KbMapEdge[]> {
    const grouped = new Map<string, KbMapEdge[]>();
    for (const edge of edges) {
      const sourceId = this.getEdgeSourceId(edge);
      if (!sourceId) continue;
      const list = grouped.get(sourceId) || [];
      list.push(edge);
      grouped.set(sourceId, list);
    }

    for (const [sourceId, list] of grouped.entries()) {
      list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      grouped.set(sourceId, list);
    }

    return grouped;
  }

  private toViewChoice(edge: KbMapEdge, index: number, nodeLookup: Map<string, KbMapNode>): KbMapViewChoice {
    const targetId = this.getEdgeTargetId(edge);
    const targetNode = targetId ? nodeLookup.get(targetId) : undefined;
    const targetTitle = (targetNode?.title || targetNode?.label || `#${targetId || 'Unlinked'}`).trim();
    const rawLabel = (edge as unknown as { label?: string; name?: string; text?: string }).label
      || (edge as unknown as { label?: string; name?: string; text?: string }).name
      || (edge as unknown as { label?: string; name?: string; text?: string }).text;

    return {
      id: String(edge.id || `${edge.sourceNodeId}-${index}`),
      label: String(rawLabel || `Option ${index + 1}`).trim(),
      targetNodeId: targetId || null,
      targetTitle
    };
  }

  private extractEdgesFromNodeChoices(nodes: KbMapNode[]): KbMapEdge[] {
    const edges: KbMapEdge[] = [];
    for (const node of nodes) {
      const sourceId = this.normalizeMapId(node.id);
      const rawChoices = (node as unknown as { choices?: Array<Record<string, unknown>> }).choices;
      if (!sourceId || !Array.isArray(rawChoices) || rawChoices.length === 0) {
        continue;
      }

      rawChoices.forEach((choice, choiceIndex) => {
        const targetId = this.normalizeMapId(
          choice['targetNodeId']
            ?? choice['targetId']
            ?? choice['toNodeId']
            ?? choice['toId']
            ?? choice['nextNodeId']
        );
        if (!targetId) return;

        const label = String(choice['label'] ?? choice['name'] ?? choice['text'] ?? `Option ${choiceIndex + 1}`).trim();
        const displayOrder = Number(choice['displayOrder'] ?? choiceIndex);
        const edgeId = Number(choice['id'] ?? 0);

        edges.push({
          id: Number.isFinite(edgeId) ? edgeId : 0,
          sourceNodeId: Number(sourceId) as unknown as number,
          targetNodeId: Number(targetId) as unknown as number,
          label,
          displayOrder: Number.isFinite(displayOrder) ? displayOrder : choiceIndex
        });
      });
    }
    return edges;
  }

  private getEdgeSourceId(edge: KbMapEdge): string {
    const raw = (edge as unknown as { sourceNodeId?: unknown; sourceId?: unknown; fromNodeId?: unknown; fromId?: unknown });
    return this.normalizeMapId(raw.sourceNodeId ?? raw.sourceId ?? raw.fromNodeId ?? raw.fromId);
  }

  private getEdgeTargetId(edge: KbMapEdge): string {
    const raw = (edge as unknown as { targetNodeId?: unknown; targetId?: unknown; toNodeId?: unknown; toId?: unknown });
    return this.normalizeMapId(raw.targetNodeId ?? raw.targetId ?? raw.toNodeId ?? raw.toId);
  }

  private findMapNodeById(nodeId: string | null | undefined): KbMapViewNode | undefined {
    const normalized = this.normalizeMapId(nodeId);
    if (!normalized) return undefined;
    return this.mapNodes.find(node => this.normalizeMapId(node.id) === normalized);
  }

  private normalizeMapId(value: unknown): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) return '';
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      return String(numeric);
    }
    return normalized;
  }

  private goToArticleNotFound(articleId: number): void {
    void this.router.navigate(['/v3/article-not-found'], {
      queryParams: {
        article: articleId,
        from: 'knowledge-base'
      }
    });
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.onMapCanvasMouseUp();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.flushTrackedTime();
      this.kbTrackStartedAtMs = 0;
      return;
    }
    if (this.kbTrackArticleId && this.kbTrackStartedAtMs === 0) {
      this.kbTrackStartedAtMs = Date.now();
    }
  }

  private startTrackHeartbeat(): void {
    if (typeof window === 'undefined') return;
    if (this.kbTrackTimer !== null) {
      window.clearInterval(this.kbTrackTimer);
      this.kbTrackTimer = null;
    }
    this.kbTrackTimer = window.setInterval(() => {
      this.flushTrackedTime();
    }, this.kbTrackHeartbeatMs);
  }

  private stopTrackHeartbeat(): void {
    if (typeof window === 'undefined') return;
    if (this.kbTrackTimer !== null) {
      window.clearInterval(this.kbTrackTimer);
      this.kbTrackTimer = null;
    }
  }

  private flushTrackedTime(): void {
    if (!this.kbTrackArticleId || !this.kbTrackStartedAtMs) {
      return;
    }

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - this.kbTrackStartedAtMs) / 1000);
    this.kbTrackStartedAtMs = now;

    if (elapsedSeconds <= 0) {
      return;
    }

    const payload = {
      articleId: this.kbTrackArticleId,
      secondsSpent: elapsedSeconds,
      sessionId: this.kbTrackSessionId,
      source: this.kbTrackSource
    };

    this.kbService.trackArticleTime(payload).subscribe({
      next: () => {},
      error: () => {}
    });
  }

  private buildTrackSessionId(): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `kb-${Date.now()}-${random}`;
  }

  private clearFeedbackState(): void {
    this.feedbackBubbleOpen = false;
    this.feedbackDraftSentiment = null;
    this.feedbackDraftComment = '';
    this.feedbackSubmitting = false;
    this.feedbackInfo = '';
    this.feedbackInfoTone = '';
  }
}
