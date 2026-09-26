import { CommonModule, Location } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideArrowLeft, LucideBookOpen } from '@lucide/angular';
import { MermaidContentDirective } from '../../directives/mermaid-content';
import { KbArticleMap, KbMapEdge, KbMapNode } from '../../services/kb';
import { KnowledgeHubArticle, KnowledgeHubService } from '../../services/knowledge-hub';
import { Subscription } from 'rxjs';

interface HubMapViewChoice {
  id: string;
  label: string;
  targetNodeId: string | null;
  targetTitle: string;
}

interface HubMapViewNode {
  id: string;
  title: string;
  content: string;
  hasInfo: boolean;
  isStart: boolean;
  x: number;
  y: number;
  choices: HubMapViewChoice[];
}

@Component({
  selector: 'app-knowledge-hub-reader',
  standalone: true,
  imports: [CommonModule, LucideArrowLeft, LucideBookOpen, MermaidContentDirective],
  templateUrl: './knowledge-hub-reader.html',
  styleUrls: ['./knowledge-hub.css']
})
export class KnowledgeHubReaderComponent implements OnInit, OnDestroy {
  @ViewChild('mapCanvasRef') mapCanvasRef?: ElementRef<HTMLDivElement>;
  @ViewChild('mapWorldRef') mapWorldRef?: ElementRef<HTMLDivElement>;
  @ViewChild('stepCloseButton') stepCloseButton?: ElementRef<HTMLButtonElement>;
  @ViewChildren('mapNodeRef') mapNodeRefs?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('mapChoiceRef') mapChoiceRefs?: QueryList<ElementRef<HTMLElement>>;

  article?: KnowledgeHubArticle;
  loading = true;
  notFound = false;
  mapOpen = false;
  mapNodes: HubMapViewNode[] = [];
  selectedMapNode: HubMapViewNode | null = null;
  isPanningMap = false;
  mapZoom = 1;
  mapPanX = 0;
  mapPanY = 0;
  mapLoading = false;
  mapError = '';
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private lastMapFocus: HTMLElement | null = null;
  private routeSub?: Subscription;

  constructor(
    private hubService: KnowledgeHubService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const articleId = Number(params.get('articleId'));
      this.loading = true;
      this.hubService.loadArticle(articleId).subscribe({
        next: article => {
          this.article = article;
          this.notFound = !this.article;
          this.mapOpen = false;
          this.mapNodes = [];
          this.selectedMapNode = null;
          this.mapZoom = 1;
          this.mapError = '';
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.notFound = true;
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  goBack(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/v3/knowledge-hub']);
  }

  goToCategory(): void {
    if (!this.article?.categoryId) return this.goBack();
    void this.router.navigate(['/v3/knowledge-hub/category', this.article.categoryId]);
  }

  toggleMap(): void {
    if (!this.article?.hasMap || this.mapLoading) return;
    if (this.mapOpen) {
      this.mapOpen = false;
      this.selectedMapNode = null;
      return;
    }

    this.mapLoading = true;
    this.mapError = '';
    this.hubService.loadMap(this.article.id).subscribe({
      next: articleMap => {
        this.mapLoading = false;
        if (!articleMap?.nodes?.length) {
          this.mapError = 'No map or SOP has been configured for this article.';
          this.article!.hasMap = false;
          return;
        }
        this.article!.map = articleMap;
        this.mapOpen = true;
        this.selectedMapNode = null;
        this.buildArticleMap(articleMap);
        this.cdr.detectChanges();
        window.requestAnimationFrame(() => this.cdr.detectChanges());
      },
      error: () => {
        this.mapLoading = false;
        this.mapError = 'The map could not be loaded. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  onMapNodeClick(nodeId: string): void {
    if (this.isPanningMap) return;
    const node = this.findMapNodeById(nodeId);
    if (!node?.hasInfo) return;
    this.openStepOverlay(node);
  }

  onMapNodeKeydown(node: HubMapViewNode, event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
    keyboardEvent.preventDefault();
    if (node.hasInfo) this.openStepOverlay(node);
  }

  onMapChoiceClick(sourceNodeId: string, choice: HubMapViewChoice, event: MouseEvent): void {
    event.stopPropagation();
    const target = choice.targetNodeId ? this.findMapNodeById(choice.targetNodeId) : undefined;
    const node = target?.hasInfo ? target : this.findMapNodeById(sourceNodeId);
    if (node?.hasInfo) this.openStepOverlay(node);
  }

  openStepOverlay(node: HubMapViewNode): void {
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
      if (this.lastMapFocus?.isConnected) this.lastMapFocus.focus();
      this.lastMapFocus = null;
    }, 0);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.selectedMapNode) this.closeStepOverlay();
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

  getMapChoiceConnectionPath(sourceNodeId: string, choiceIndex: number, targetNodeId: string | null): string {
    if (!targetNodeId) return '';

    const source = this.findMapNodeById(sourceNodeId);
    const target = this.findMapNodeById(targetNodeId);
    if (!source || !target) return '';

    const sourceAnchor = this.getMapChoiceAnchor(source, choiceIndex);
    const targetAnchor = this.getNodeAnchor(target.id, 'left');
    const controlOffset = Math.max(70, Math.abs(targetAnchor.x - sourceAnchor.x) * 0.35);

    return `M ${sourceAnchor.x} ${sourceAnchor.y} C ${sourceAnchor.x + controlOffset} ${sourceAnchor.y}, ${targetAnchor.x - controlOffset} ${targetAnchor.y}, ${targetAnchor.x} ${targetAnchor.y}`;
  }

  getMapWorldTransform(): string {
    return `translate(${this.mapPanX}px, ${this.mapPanY}px) scale(${this.mapZoom})`;
  }

  onMapWheel(event: WheelEvent): void {
    const canvas = this.mapCanvasRef?.nativeElement;
    if (!canvas) return;

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const nextZoom = Math.min(2.4, Math.max(0.55, this.mapZoom * (event.deltaY < 0 ? 1.1 : 0.9)));
    if (nextZoom === this.mapZoom) return;

    const worldX = (cursorX - this.mapPanX) / this.mapZoom;
    const worldY = (cursorY - this.mapPanY) / this.mapZoom;
    this.mapZoom = nextZoom;
    this.mapPanX = cursorX - worldX * nextZoom;
    this.mapPanY = cursorY - worldY * nextZoom;
    this.cdr.detectChanges();
  }

  onMapCanvasMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.kb-map-node-card')) return;

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
    return Math.max(1200, Math.max(...this.mapNodes.map(node => node.x + 420)));
  }

  getMapWorldHeight(): number {
    if (!this.mapNodes.length) return 900;
    const maxBottom = Math.max(...this.mapNodes.map(node => node.y + 112 + node.choices.length * 30));
    return Math.max(900, maxBottom + 140);
  }

  getStepOverlayContent(node: HubMapViewNode): string {
    return node.content || '<p>No details were added for this step yet.</p>';
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.onMapCanvasMouseUp();
  }

  private buildArticleMap(map: KbArticleMap): void {
    const nodes = Array.isArray(map.nodes) ? map.nodes : [];
    const mapEdges = Array.isArray(map.edges) ? map.edges : [];
    const edges = mapEdges.length > 0 ? mapEdges : this.extractEdgesFromNodeChoices(nodes);
    const edgesBySource = this.groupEdgesBySource(edges);
    const nodeLookup = new Map<string, KbMapNode>(nodes.map(node => [this.normalizeMapId(node.id), node]));
    const hasAnyPosition = nodes.some(node => this.getNodeX(node) !== null || this.getNodeY(node) !== null);

    const viewNodes = nodes.map((node, index) => {
      const id = this.normalizeMapId(node.id);
      const title = (node.title || node.label || `Step ${node.id}`).trim();
      const content = (node.content || '').trim();
      const sourceEdges = edgesBySource.get(id) || [];
      return {
        id,
        title,
        content,
        hasInfo: this.hasMeaningfulContent(content),
        isStart: !!node.isStart,
        x: hasAnyPosition ? (this.getNodeX(node) ?? this.defaultNodeX(index)) : this.defaultNodeX(index),
        y: hasAnyPosition ? (this.getNodeY(node) ?? this.defaultNodeY(index)) : this.defaultNodeY(index),
        choices: sourceEdges.map((edge, edgeIndex) => this.toViewChoice(edge, edgeIndex, nodeLookup))
      } as HubMapViewNode;
    });

    if (viewNodes.length && !viewNodes.some(node => node.isStart)) viewNodes[0].isStart = true;
    this.mapNodes = this.layoutNodesHorizontally(viewNodes);
    this.mapZoom = 1;
    this.mapPanX = 0;
    this.mapPanY = 0;
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

  private defaultNodeX(index: number): number { return 40 + (index % 3) * 360; }

  private defaultNodeY(index: number): number { return 40 + Math.floor(index / 3) * 220; }

  private getNodeAnchor(nodeId: string, side: 'left' | 'right'): { x: number; y: number } {
    const nodeRef = this.mapNodeRefs?.find(ref => this.normalizeMapId(ref.nativeElement.dataset['nodeId']) === this.normalizeMapId(nodeId));
    if (nodeRef) {
      const element = nodeRef.nativeElement;
      // Use layout coordinates, not getBoundingClientRect(), because the whole world is zoomed.
      return {
        x: element.offsetLeft + (side === 'right' ? element.offsetWidth : 0),
        y: element.offsetTop + element.offsetHeight / 2
      };
    }

    const node = this.findMapNodeById(nodeId);
    if (!node) return { x: 0, y: 0 };
    return { x: side === 'right' ? node.x + 296 : node.x, y: node.y + 42 };
  }

  private getMapChoiceAnchor(source: HubMapViewNode, choiceIndex: number): { x: number; y: number } {
    const choice = source.choices[choiceIndex];
    const canvas = this.mapCanvasRef?.nativeElement;
    const choiceRef = this.mapChoiceRefs?.find(ref =>
      ref.nativeElement.dataset['choiceId'] === String(choice?.id) &&
      ref.nativeElement.dataset['sourceId'] === String(source.id)
    );

    if (canvas && choiceRef) {
      const canvasRect = canvas.getBoundingClientRect();
      const choiceRect = choiceRef.nativeElement.getBoundingClientRect();
      return {
        x: (choiceRect.right - canvasRect.left - this.mapPanX) / this.mapZoom,
        y: (choiceRect.top - canvasRect.top + (choiceRect.height / 2) - this.mapPanY) / this.mapZoom
      };
    }

    return {
      x: source.x + 296,
      y: source.y + 86 + choiceIndex * 30
    };
  }

  private layoutNodesHorizontally(nodes: HubMapViewNode[]): HubMapViewNode[] {
    if (!nodes.length) return [];

    const nodeById = new Map(nodes.map(node => [node.id, { ...node }]));
    const incoming = new Map<string, string[]>();
    for (const node of nodes) incoming.set(node.id, []);
    for (const node of nodes) {
      for (const choice of node.choices) {
        const targetId = this.normalizeMapId(choice.targetNodeId);
        if (!targetId || !nodeById.has(targetId)) continue;
        incoming.get(targetId)?.push(node.id);
      }
    }

    const roots = nodes.filter(node => node.isStart).length
      ? nodes.filter(node => node.isStart)
      : nodes.filter(node => !(incoming.get(node.id) || []).length);
    const queue = (roots.length ? roots : [nodes[0]]).map(node => node.id);
    const levels = new Map<string, number>(queue.map(id => [id, 0]));
    while (queue.length) {
      const currentId = queue.shift()!;
      const current = nodeById.get(currentId);
      if (!current) continue;
      const level = levels.get(currentId) || 0;
      for (const choice of current.choices) {
        const targetId = this.normalizeMapId(choice.targetNodeId);
        if (!targetId || !nodeById.has(targetId)) continue;
        const nextLevel = level + 1;
        if (!levels.has(targetId) || nextLevel < levels.get(targetId)!) {
          levels.set(targetId, nextLevel);
          queue.push(targetId);
        }
      }
    }

    let maxLevel = Math.max(0, ...Array.from(levels.values()));
    for (const node of nodes) {
      if (!levels.has(node.id)) levels.set(node.id, ++maxLevel);
    }

    const byLevel = new Map<number, HubMapViewNode[]>();
    for (const node of nodes) {
      const level = levels.get(node.id) || 0;
      const bucket = byLevel.get(level) || [];
      bucket.push(nodeById.get(node.id)!);
      byLevel.set(level, bucket);
    }

    const order = new Map<string, number>();
    for (const level of Array.from(byLevel.keys()).sort((a, b) => a - b)) {
      const bucket = byLevel.get(level)!;
      bucket.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      bucket.forEach((node, index) => order.set(node.id, index));
      const verticalGap = Math.max(170, ...bucket.map(node => 112 + node.choices.length * 30));
      const blockHeight = (bucket.length - 1) * verticalGap;
      bucket.forEach((node, index) => {
        node.x = 120 + level * 420;
        node.y = 260 + index * verticalGap - blockHeight / 2;
      });
    }
    return Array.from(nodeById.values());
  }

  private centerMapOnStartNode(): void {
    const startNode = this.mapNodes.find(node => node.isStart) || this.mapNodes[0];
    if (!startNode) return;
    const center = () => {
      const canvas = this.mapCanvasRef?.nativeElement;
      if (!canvas) return;
      this.mapPanX = canvas.clientWidth / 2 - (startNode.x + 148);
      this.mapPanY = canvas.clientHeight / 2 - (startNode.y + 42);
      this.cdr.detectChanges();
    };
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => window.requestAnimationFrame(center));
    } else {
      center();
    }
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
    for (const [sourceId, list] of grouped) {
      list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      grouped.set(sourceId, list);
    }
    return grouped;
  }

  private toViewChoice(edge: KbMapEdge, index: number, nodeLookup: Map<string, KbMapNode>): HubMapViewChoice {
    const targetId = this.getEdgeTargetId(edge);
    const targetNode = targetId ? nodeLookup.get(targetId) : undefined;
    const raw = edge as unknown as { label?: string; name?: string; text?: string };
    return {
      id: String(edge.id || `${edge.sourceNodeId}-${index}`),
      label: String(raw.label || raw.name || raw.text || `Option ${index + 1}`).trim(),
      targetNodeId: targetId || null,
      targetTitle: (targetNode?.title || targetNode?.label || `#${targetId || 'Unlinked'}`).trim()
    };
  }

  private extractEdgesFromNodeChoices(nodes: KbMapNode[]): KbMapEdge[] {
    const edges: KbMapEdge[] = [];
    for (const node of nodes) {
      const sourceId = this.normalizeMapId(node.id);
      const choices = (node as unknown as { choices?: Array<Record<string, unknown>> }).choices;
      if (!sourceId || !Array.isArray(choices)) continue;
      choices.forEach((choice, index) => {
        const targetId = this.normalizeMapId(choice['targetNodeId'] ?? choice['targetId'] ?? choice['toNodeId'] ?? choice['toId'] ?? choice['nextNodeId']);
        if (!targetId) return;
        edges.push({
          id: Number(choice['id'] ?? 0),
          sourceNodeId: Number(sourceId) as unknown as number,
          targetNodeId: Number(targetId) as unknown as number,
          label: String(choice['label'] ?? choice['name'] ?? choice['text'] ?? `Option ${index + 1}`).trim(),
          displayOrder: Number(choice['displayOrder'] ?? index)
        });
      });
    }
    return edges;
  }

  private getEdgeSourceId(edge: KbMapEdge): string {
    const raw = edge as unknown as { sourceNodeId?: unknown; sourceId?: unknown; fromNodeId?: unknown; fromId?: unknown };
    return this.normalizeMapId(raw.sourceNodeId ?? raw.sourceId ?? raw.fromNodeId ?? raw.fromId);
  }

  private getEdgeTargetId(edge: KbMapEdge): string {
    const raw = edge as unknown as { targetNodeId?: unknown; targetId?: unknown; toNodeId?: unknown; toId?: unknown };
    return this.normalizeMapId(raw.targetNodeId ?? raw.targetId ?? raw.toNodeId ?? raw.toId);
  }

  private findMapNodeById(nodeId: string | null | undefined): HubMapViewNode | undefined {
    const normalized = this.normalizeMapId(nodeId);
    return normalized ? this.mapNodes.find(node => this.normalizeMapId(node.id) === normalized) : undefined;
  }

  private normalizeMapId(value: unknown): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) return '';
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? String(numeric) : normalized;
  }

  private hasMeaningfulContent(content: string): boolean {
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length > 0;
  }
}
