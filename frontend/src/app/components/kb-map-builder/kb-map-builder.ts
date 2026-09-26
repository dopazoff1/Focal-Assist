import { CommonModule } from '@angular/common';
import { ApplicationRef, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EditorModule, TINYMCE_SCRIPT_SRC } from '@tinymce/tinymce-angular';
import {
  KbArticle,
  KbArticleMap,
  KbCategory,
  KbMapEdge,
  KbMapNode,
  KbMapSavePayload,
  KbService
} from '../../services/kb';
import { createfocalRichEditorInit } from '../../utils/rich-editor-config';

interface BuilderChoice {
  id: number;
  label: string;
  targetNodeId: number | null;
  displayOrder: number;
  isPersisted: boolean;
}

interface BuilderNode {
  id: number;
  title: string;
  content: string;
  isStart: boolean;
  x: number;
  y: number;
  choices: BuilderChoice[];
  isPersisted: boolean;
}

@Component({
  selector: 'app-kb-map-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, EditorModule],
  providers: [
    { provide: TINYMCE_SCRIPT_SRC, useValue: '/tinymce/tinymce.min.js' }
  ],
  templateUrl: './kb-map-builder.html',
  styleUrls: ['./kb-map-builder.css']
})
export class KbMapBuilder implements OnInit {
  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLDivElement>;
  @ViewChildren('choiceWireBtn') choiceWireButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  categories: KbCategory[] = [];
  articlesMap: Record<number, KbArticle[]> = {};
  selectedArticleId: number | null = null;

  nodes: BuilderNode[] = [];
  selectedNodeId: number | null = null;
  draggingNodeId: number | null = null;
  wireFromChoice: { sourceNodeId: number; choiceId: number } | null = null;
  wireMouseX = 0;
  wireMouseY = 0;
  dragOffsetX = 0;
  dragOffsetY = 0;
  isPanningCanvas = false;
  canvasPanX = 0;
  canvasPanY = 0;
  canvasZoom = 1;
  private panStartX = 0;
  private panStartY = 0;

  nextNodeId = 1000;
  nextChoiceId = 5000;
  statusMessage = '';
  lastSaveErrorDetails = '';
  isLoading = false;
  isSaving = false;
  mapLoaded = false;

  newChoiceLabel = '';
  jsonOutput = '';
  readonly nodeEditorInit = createfocalRichEditorInit(320);

  constructor(
    private kbService: KbService,
    private cdr: ChangeDetectorRef,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    void this.loadCategoriesAndArticles();
  }

  get selectedNode(): BuilderNode | undefined {
    return this.nodes.find(n => n.id === this.selectedNodeId);
  }

  get articleOptions(): KbArticle[] {
    return Object.values(this.articlesMap).flat();
  }

  get selectedArticle(): KbArticle | undefined {
    return this.articleOptions.find(a => a.id === this.selectedArticleId);
  }

  async onArticleChange(): Promise<void> {
    await this.loadSelectedArticleMap();
  }

  addNode(): void {
    const node: BuilderNode = {
      id: this.nextNodeId++,
      title: `Step ${this.nextNodeId - 1}`,
      content: '<p>Describe this step...</p>',
      isStart: this.nodes.length === 0,
      x: 120 + (this.nodes.length % 4) * 260,
      y: 80 + Math.floor(this.nodes.length / 4) * 180,
      choices: [],
      isPersisted: false
    };
    this.nodes.push(node);
    this.selectedNodeId = node.id;
    this.statusMessage = 'Node added.';
    this.requestMapRefresh();
  }

  async reloadCurrentArticleMap(): Promise<void> {
    await this.loadSelectedArticleMap();
  }

  async saveToDatabase(): Promise<void> {
    if (!this.selectedArticleId) {
      this.statusMessage = 'Please select an article first.';
      return;
    }

    if (!this.nodes.length) {
      this.statusMessage = 'Nothing to save.';
      return;
    }

    const firstUnlinked = this.nodes.find(node => node.choices.some(choice => !choice.targetNodeId));
    if (firstUnlinked) {
      this.selectedNodeId = firstUnlinked.id;
      this.statusMessage = `Please link all choices before saving. Node #${firstUnlinked.id} has unlinked choices.`;
      return;
    }

    this.isSaving = true;
    this.lastSaveErrorDetails = '';
    this.statusMessage = 'Saving KB map...';

    try {
      const payload = this.buildSavePayload();
      const response = await firstValueFrom(this.kbService.saveArticleMap(this.selectedArticleId, payload));
      this.statusMessage = response?.pendingValidation
        ? 'KB map saved to the draft. It will publish after validation.'
        : 'KB map saved.';
      await this.loadSelectedArticleMap();
    } catch (error: unknown) {
      const httpError = error as HttpErrorResponse;
      const apiMessage =
        typeof httpError?.error === 'string'
          ? httpError.error
          : (httpError?.error?.message as string | undefined) ||
            (httpError?.error?.error as string | undefined);
      const genericMessage =
        (error as Error | undefined)?.message ||
        httpError?.message ||
        'Unknown error';

      if (httpError?.status) {
        this.statusMessage = apiMessage
          ? `Failed to save (${httpError.status}): ${apiMessage}`
          : `Failed to save (${httpError.status}).`;
      } else {
        this.statusMessage = `Failed to save: ${apiMessage || genericMessage}`;
      }

      const errorBody =
        httpError?.error === undefined
          ? ''
          : typeof httpError.error === 'string'
            ? httpError.error
            : JSON.stringify(httpError.error, null, 2);

      this.lastSaveErrorDetails = [
        `status: ${httpError?.status ?? 'n/a'}`,
        `url: ${httpError?.url ?? 'n/a'}`,
        `message: ${httpError?.message ?? genericMessage}`,
        `apiMessage: ${apiMessage ?? 'n/a'}`,
        `time: ${new Date().toISOString()}`,
        '',
        'errorBody:',
        errorBody || '(empty)',
        '',
        'stack:',
        (error as Error)?.stack || '(no stack)'
      ].join('\n');
      console.error('Save KB map failed', error);
    } finally {
      this.isSaving = false;
      this.requestMapRefresh();
    }
  }

  autoLayout(): void {
    if (!this.nodes.length) return;

    const nodeById = new Map(this.nodes.map(n => [n.id, n]));
    const visited = new Set<number>();
    const levelMap = new Map<number, number>();
    const queue: Array<{ id: number; level: number }> = [];

    const startIds = this.nodes.filter(n => n.isStart).map(n => n.id);
    if (!startIds.length && this.nodes.length) {
      startIds.push(this.nodes[0].id);
    }

    for (const id of startIds) {
      queue.push({ id, level: 0 });
    }

    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      levelMap.set(current.id, current.level);

      const node = nodeById.get(current.id);
      if (!node) continue;
      for (const choice of node.choices) {
        if (!choice.targetNodeId) continue;
        if (!visited.has(choice.targetNodeId)) {
          queue.push({ id: choice.targetNodeId, level: current.level + 1 });
        }
      }
    }

    let maxLevel = Math.max(0, ...Array.from(levelMap.values()));
    for (const node of this.nodes) {
      if (!levelMap.has(node.id)) {
        maxLevel += 1;
        levelMap.set(node.id, maxLevel);
      }
    }

    const byLevel = new Map<number, BuilderNode[]>();
    for (const node of this.nodes) {
      const level = levelMap.get(node.id) ?? 0;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)!.push(node);
    }

    const horizontalGap = 360;
    const verticalGap = 190;
    const baseX = 80;
    const baseY = 60;

    const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);
    for (const level of sortedLevels) {
      const nodesAtLevel = byLevel.get(level)!;
      nodesAtLevel.sort((a, b) => a.id - b.id);
      nodesAtLevel.forEach((node, index) => {
        node.x = baseX + level * horizontalGap;
        node.y = baseY + index * verticalGap;
      });
    }

    this.statusMessage = 'Auto layout applied.';
    this.requestMapRefresh();
  }

  deleteSelectedNode(): void {
    if (!this.selectedNodeId) return;
    const id = this.selectedNodeId;
    this.nodes = this.nodes
      .filter(n => n.id !== id)
      .map(n => ({ ...n, choices: n.choices.filter(c => c.targetNodeId !== id) }));
    this.selectedNodeId = this.nodes[0]?.id ?? null;
    this.statusMessage = 'Node deleted.';
    this.requestMapRefresh();
  }

  selectNode(nodeId: number): void {
    this.selectedNodeId = nodeId;
    this.requestMapRefresh();
  }

  startDrag(event: MouseEvent, node: BuilderNode): void {
    event.preventDefault();
    event.stopPropagation();
    this.isPanningCanvas = false;
    this.selectedNodeId = node.id;
    this.draggingNodeId = node.id;
    const { x, y } = this.getCanvasPoint(event);
    this.dragOffsetX = x - node.x;
    this.dragOffsetY = y - node.y;
    this.requestMapRefresh();
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (this.wireFromChoice || this.draggingNodeId) {
      return;
    }
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (target.closest('.node-card') || target.closest('.choice-wire')) {
      return;
    }

    this.isPanningCanvas = true;
    this.panStartX = event.clientX - this.canvasPanX;
    this.panStartY = event.clientY - this.canvasPanY;
    event.preventDefault();
    this.requestMapRefresh();
  }

  onCanvasWheel(event: WheelEvent): void {
    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (!rect) {
      return;
    }

    event.preventDefault();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = (pointerX - this.canvasPanX) / this.canvasZoom;
    const worldY = (pointerY - this.canvasPanY) / this.canvasZoom;

    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(2.5, Math.max(0.35, this.canvasZoom * zoomFactor));
    if (newZoom === this.canvasZoom) {
      return;
    }

    this.canvasZoom = newZoom;
    this.canvasPanX = pointerX - worldX * newZoom;
    this.canvasPanY = pointerY - worldY * newZoom;
    this.requestMapRefresh();
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.isPanningCanvas) {
      this.canvasPanX = event.clientX - this.panStartX;
      this.canvasPanY = event.clientY - this.panStartY;
      this.requestMapRefresh();
      return;
    }

    const { x, y } = this.getCanvasPoint(event);
    this.wireMouseX = x;
    this.wireMouseY = y;
    if (this.wireFromChoice) {
      this.requestMapRefresh();
    }

    if (!this.draggingNodeId) return;
    const node = this.nodes.find(n => n.id === this.draggingNodeId);
    if (!node) return;
    node.x = Math.max(8, x - this.dragOffsetX);
    node.y = Math.max(8, y - this.dragOffsetY);
    this.requestMapRefresh();
  }

  stopDrag(): void {
    this.draggingNodeId = null;
    this.requestMapRefresh();
  }

  stopPan(): void {
    this.isPanningCanvas = false;
    this.requestMapRefresh();
  }

  onCanvasMouseUp(): void {
    this.stopDrag();
    this.stopPan();
    if (this.wireFromChoice) {
      this.cancelWire();
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.stopDrag();
    this.stopPan();
    if (this.wireFromChoice) {
      this.cancelWire();
    }
  }

  startChoiceWire(event: MouseEvent, sourceNode: BuilderNode, choice: BuilderChoice): void {
    event.preventDefault();
    event.stopPropagation();
    const { x, y } = this.getCanvasPoint(event);
    this.wireFromChoice = { sourceNodeId: sourceNode.id, choiceId: choice.id };
    this.wireMouseX = x;
    this.wireMouseY = y;
    this.statusMessage = `Rewiring choice "${choice.label}" from #${sourceNode.id}: drop on a target node.`;
  }

  completeWire(event: MouseEvent, targetNode: BuilderNode): void {
    if (!this.wireFromChoice) return;
    event.preventDefault();
    event.stopPropagation();

    const sourceNode = this.getNodeById(this.wireFromChoice.sourceNodeId);
    const sourceChoice = sourceNode?.choices.find(c => c.id === this.wireFromChoice?.choiceId);
    if (!sourceNode || !sourceChoice) {
      this.cancelWire();
      return;
    }

    if (sourceNode.id === targetNode.id) {
      this.cancelWire('Cannot link a choice to its own node.');
      return;
    }

    sourceChoice.targetNodeId = targetNode.id;
    this.selectedNodeId = sourceNode.id;
    this.cancelWire(`Choice "${sourceChoice.label}" now points to #${targetNode.id}.`);
    this.requestMapRefresh();
  }

  cancelWire(message = 'Wiring canceled.'): void {
    this.wireFromChoice = null;
    this.statusMessage = message;
    this.requestMapRefresh();
  }

  addChoice(): void {
    const node = this.selectedNode;
    if (!node || !this.newChoiceLabel.trim()) return;
    node.choices.push({
      id: this.nextChoiceId++,
      label: this.newChoiceLabel.trim(),
      targetNodeId: null,
      displayOrder: node.choices.length + 1,
      isPersisted: false
    });
    this.newChoiceLabel = '';
    this.statusMessage = 'Choice added. Use the + on the map to link it.';
    this.requestMapRefresh();
  }

  removeChoice(choiceId: number): void {
    const node = this.selectedNode;
    if (!node) return;
    node.choices = node.choices.filter(c => c.id !== choiceId);
    this.statusMessage = 'Choice removed.';
    this.requestMapRefresh();
  }

  setAsStart(nodeId: number): void {
    this.nodes.forEach(n => (n.isStart = n.id === nodeId));
    this.statusMessage = `Node ${nodeId} set as start.`;
    this.requestMapRefresh();
  }

  onNodeEdited(): void {
    this.nodes = [...this.nodes];
    this.requestMapRefresh();
  }

  exportJson(): void {
    const payload = this.buildSavePayload();
    this.jsonOutput = JSON.stringify(payload, null, 2);
    this.statusMessage = 'JSON payload generated.';
  }

  copyJson(): void {
    if (!this.jsonOutput) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(this.jsonOutput);
      this.statusMessage = 'JSON payload copied.';
    }
  }

  private async loadCategoriesAndArticles(): Promise<void> {
    this.isLoading = true;
    this.statusMessage = 'Loading KB articles...';

    try {
      const categories = await firstValueFrom(this.kbService.getCategories());
      this.categories = categories;
      this.articlesMap = {};

      for (const cat of categories) {
        const articles = await firstValueFrom(this.kbService.getArticlesByCategory(cat.id));
        this.articlesMap[cat.id] = articles;
      }

      const firstArticle = this.articleOptions[0];
      this.selectedArticleId = firstArticle?.id ?? null;
      await this.loadSelectedArticleMap();
    } catch {
      this.statusMessage = 'Failed to load KB categories/articles.';
      this.nodes = [];
      this.selectedNodeId = null;
      this.requestMapRefresh();
    } finally {
      this.isLoading = false;
      this.requestMapRefresh();
    }
  }

  private async loadSelectedArticleMap(): Promise<void> {
    if (!this.selectedArticleId) {
      this.nodes = [];
      this.selectedNodeId = null;
      this.mapLoaded = false;
      return;
    }

    this.isLoading = true;
    this.statusMessage = 'Loading article map...';
    this.lastSaveErrorDetails = '';

    try {
      const map = await firstValueFrom(this.kbService.getArticleMap(this.selectedArticleId));
      this.applyMap(map);
      this.mapLoaded = true;
      this.statusMessage = `Loaded map for article #${this.selectedArticleId}.`;
    } catch {
      this.nodes = [];
      this.selectedNodeId = null;
      this.nextNodeId = 1000;
      this.nextChoiceId = 5000;
      this.addNode();
      this.mapLoaded = false;
      this.statusMessage = `No map found for article #${this.selectedArticleId}. Started a new draft.`;
    } finally {
      this.isLoading = false;
      this.requestMapRefresh();
    }
  }

  private applyMap(map: KbArticleMap): void {
    const rawNodes = Array.isArray(map.nodes) ? map.nodes : [];
    const rawEdges = Array.isArray(map.edges) ? map.edges : [];

    const edgesBySource = new Map<number, KbMapEdge[]>();
    for (const edge of rawEdges) {
      const list = edgesBySource.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      edgesBySource.set(edge.sourceNodeId, list);
    }

    this.nodes = rawNodes.map((node, index) => {
      const nodeId = node.id;
      const edgeChoices = (edgesBySource.get(nodeId) ?? [])
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
        .map((edge, edgeIndex) => ({
          id: edge.id,
          label: edge.label || `Choice ${edgeIndex + 1}`,
          targetNodeId: edge.targetNodeId,
          displayOrder: edge.displayOrder ?? edgeIndex,
          isPersisted: true
        }));

      return {
        id: nodeId,
        title: node.title || node.label || `Node ${nodeId}`,
        content: node.content || '<p>Describe this step...</p>',
        isStart: !!node.isStart,
        x: typeof node.xPos === 'number' ? node.xPos : (typeof node.x === 'number' ? node.x : 120 + (index % 4) * 280),
        y: typeof node.yPos === 'number' ? node.yPos : (typeof node.y === 'number' ? node.y : 80 + Math.floor(index / 4) * 180),
        choices: edgeChoices,
        isPersisted: true
      } as BuilderNode;
    });

    if (!this.nodes.length) {
      this.addNode();
    }

    const hasStart = this.nodes.some(n => n.isStart);
    if (!hasStart && this.nodes.length) {
      this.nodes[0].isStart = true;
    }

    const maxNodeId = Math.max(...this.nodes.map(n => n.id));
    const maxChoiceId = Math.max(0, ...this.nodes.flatMap(n => n.choices.map(c => c.id)));
    this.nextNodeId = Math.max(1000, maxNodeId + 1);
    this.nextChoiceId = Math.max(5000, maxChoiceId + 1);

    this.selectedNodeId = this.nodes.find(n => n.isStart)?.id ?? this.nodes[0].id;
    this.autoLayout();
  }

  private buildSavePayload(): KbMapSavePayload {
    const nodes: KbMapNode[] = this.nodes.map(node => ({
      id: node.id,
      articleId: this.selectedArticleId ?? undefined,
      title: node.title,
      label: node.title,
      content: this.normalizeNodeContent(node.content),
      xPos: Math.round(node.x),
      yPos: Math.round(node.y),
      isStart: node.isStart
    }));

    const edges: KbMapEdge[] = [];
    for (const source of this.nodes) {
      for (const choice of source.choices) {
        if (!choice.targetNodeId) continue;
        edges.push({
          id: choice.isPersisted ? choice.id : 0,
          sourceNodeId: source.id,
          targetNodeId: choice.targetNodeId,
          label: choice.label,
          displayOrder: choice.displayOrder
        });
      }
    }

    return {
      articleId: this.selectedArticleId ?? undefined,
      nodes,
      edges
    };
  }

  private normalizeNodeContent(content: string | null | undefined): string {
    const raw = (content ?? '').toString();
    const plain = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plain.length === 0) {
      // Keep HTML non-empty for backends that reject empty content.
      return '<p></p>';
    }
    return raw;
  }

  private getCanvasPoint(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (!rect) {
      return { x: event.clientX, y: event.clientY };
    }
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    return {
      x: (localX - this.canvasPanX) / this.canvasZoom,
      y: (localY - this.canvasPanY) / this.canvasZoom
    };
  }

  private requestMapRefresh(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.appRef.tick();
  }

  getCanvasTransform(): string {
    return `translate(${this.canvasPanX}px, ${this.canvasPanY}px) scale(${this.canvasZoom})`;
  }

  getCanvasBackgroundSize(): string {
    const grid = 32 * this.canvasZoom;
    return `${grid}px ${grid}px`;
  }

  getCanvasBackgroundPosition(): string {
    return `${this.canvasPanX}px ${this.canvasPanY}px`;
  }

  getNodeById(id: number): BuilderNode | undefined {
    return this.nodes.find(n => n.id === id);
  }

  private getChoiceAnchor(source: BuilderNode, choice: BuilderChoice): { x: number; y: number } {
    const canvasRect = this.canvasRef?.nativeElement.getBoundingClientRect();
    const buttonRef = this.choiceWireButtons?.find(ref =>
      ref.nativeElement.dataset['choiceId'] === String(choice.id) &&
      ref.nativeElement.dataset['sourceId'] === String(source.id)
    );

    if (canvasRect && buttonRef) {
      const buttonRect = buttonRef.nativeElement.getBoundingClientRect();
      return {
        x: (buttonRect.left - canvasRect.left + (buttonRect.width / 2) - this.canvasPanX) / this.canvasZoom,
        y: (buttonRect.top - canvasRect.top + (buttonRect.height / 2) - this.canvasPanY) / this.canvasZoom
      };
    }

    const index = source.choices.findIndex(c => c.id === choice.id);
    const normalizedIndex = index < 0 ? 0 : index;
    return {
      x: source.x + 296,
      y: source.y + 114 + normalizedIndex * 28
    };
  }

  getConnectionPath(source: BuilderNode, choice: BuilderChoice): string {
    if (!choice.targetNodeId) return '';
    const target = this.getNodeById(choice.targetNodeId);
    if (!target) return '';

    const start = this.getChoiceAnchor(source, choice);
    const endX = target.x;
    const endY = target.y + 56;
    const controlOffset = Math.max(70, Math.abs(endX - start.x) * 0.35);
    const c1x = start.x + controlOffset;
    const c1y = start.y;
    const c2x = endX - controlOffset;
    const c2y = endY;
    return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
  }

  getLiveWirePath(): string {
    if (!this.wireFromChoice) return '';

    const source = this.getNodeById(this.wireFromChoice.sourceNodeId);
    const choice = source?.choices.find(c => c.id === this.wireFromChoice?.choiceId);
    if (!source || !choice) return '';

    const anchor = this.getChoiceAnchor(source, choice);
    const startX = anchor.x;
    const startY = anchor.y;
    const endX = this.wireMouseX;
    const endY = this.wireMouseY;

    const controlOffset = Math.max(60, Math.abs(endX - startX) * 0.35);
    const c1x = startX + controlOffset;
    const c1y = startY;
    const c2x = endX - controlOffset;
    const c2y = endY;
    return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
  }
}

