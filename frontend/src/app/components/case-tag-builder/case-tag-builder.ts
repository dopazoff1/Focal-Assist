import { CommonModule } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  CaseTagEdge,
  CaseTagMap,
  CaseTagMapSavePayload,
  CaseTagNode,
  CaseTagsService
} from '../../services/case-tags';

type CaseTagNodeKind = 'category' | 'subcategory' | 'subdivision' | 'choice' | 'invalid';

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
  // Stored as `isStart` in the DB model; we use it to mark root Categories.
  isStart: boolean;
  x: number;
  y: number;
  choices: BuilderChoice[];
  isPersisted: boolean;
}

@Component({
  selector: 'app-case-tag-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './case-tag-builder.html',
  styleUrls: ['./case-tag-builder.css']
})
export class CaseTagBuilder implements OnInit {
  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLDivElement>;
  @ViewChildren('choiceWireBtn') choiceWireButtons?: QueryList<ElementRef<HTMLButtonElement>>;

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

  newChoiceLabel = '';
  jsonOutput = '';

  constructor(
    private caseTagsService: CaseTagsService,
    private cdr: ChangeDetectorRef,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    void this.loadMap();
  }

  get selectedNode(): BuilderNode | undefined {
    return this.nodes.find(n => n.id === this.selectedNodeId);
  }

  // New name; UI should use this.
  addCategory(): void {
    const node: BuilderNode = {
      id: this.nextNodeId++,
      title: `Category ${this.nextNodeId - 1}`,
      content: '',
      isStart: true,
      x: 120 + (this.nodes.length % 4) * 260,
      y: 80 + Math.floor(this.nodes.length / 4) * 180,
      choices: [],
      isPersisted: false
    };
    this.nodes.push(node);
    this.recomputeRootFlags();
    this.selectedNodeId = node.id;
    this.statusMessage = 'Category added.';
    this.requestMapRefresh();
  }

  // Backward compatibility for older bindings.
  addNode(): void {
    this.addCategory();
  }

  async reloadMap(): Promise<void> {
    await this.loadMap();
  }

  async saveToDatabase(): Promise<void> {
    if (!this.nodes.length) {
      this.statusMessage = 'Nothing to save.';
      return;
    }

    // Enforce a strict tree: each tag node may have at most one parent.
    const parentByTarget = new Map<number, number>();
    for (const source of this.nodes) {
      for (const choice of source.choices) {
        if (!choice.targetNodeId) continue;
        const existingParent = parentByTarget.get(choice.targetNodeId);
        if (existingParent != null && existingParent !== source.id) {
          this.selectedNodeId = choice.targetNodeId;
          this.statusMessage = `Invalid tag tree: node #${choice.targetNodeId} has multiple parents (#${existingParent} and #${source.id}). Each tag must belong to exactly one parent.`;
          return;
        }
        parentByTarget.set(choice.targetNodeId, source.id);
      }
    }

    // Enforce max depth: Category -> Subcategory -> Sub-division -> Choice.
    for (const node of this.nodes) {
      const { depth, hasCycle } = this.getDepthForNode(node.id, parentByTarget);
      if (hasCycle) {
        this.selectedNodeId = node.id;
        this.statusMessage = `Invalid tag tree: detected a cycle involving node #${node.id}.`;
        return;
      }
      if (depth > 3) {
        this.selectedNodeId = node.id;
        this.statusMessage = `Invalid tag tree: node #${node.id} is too deep (depth ${depth}). Max depth is 3 (Choice level).`;
        return;
      }
      if (depth === 3 && node.choices.length > 0) {
        this.selectedNodeId = node.id;
        this.statusMessage = `Invalid tag tree: node #${node.id} is a Choice (leaf) but still has child links.`;
        return;
      }
    }

    const firstUnlinked = this.nodes.find(node => node.choices.some(choice => !choice.targetNodeId));
    if (firstUnlinked) {
      this.selectedNodeId = firstUnlinked.id;
      this.statusMessage = `Please link all child items before saving. Node #${firstUnlinked.id} has unlinked items.`;
      return;
    }

    this.isSaving = true;
    this.lastSaveErrorDetails = '';
    this.statusMessage = 'Saving case tag map...';

    try {
      this.recomputeRootFlags();
      const payload = this.buildSavePayload();
      await firstValueFrom(this.caseTagsService.saveMap(payload));
      this.statusMessage = 'Case tag map saved.';
      await this.loadMap();
    } catch (error: unknown) {
      const httpError = error as HttpErrorResponse;
      const apiMessage =
        typeof httpError?.error === 'string'
          ? httpError.error
          : (httpError?.error?.message as string | undefined) ||
            (httpError?.error?.error as string | undefined);
      const genericMessage =
        (error as Error | undefined)?.message || httpError?.message || 'Unknown error';

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
      // eslint-disable-next-line no-console
      console.error('Save case tag map failed', error);
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

    const rootIds = this.getRootIdsFromCurrentGraph();
    const startIds = rootIds.length ? rootIds : [this.nodes[0].id];

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
    this.recomputeRootFlags();
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
    this.statusMessage = `Rewiring "${choice.label}": drop on a target node.`;
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
      this.cancelWire('Cannot link an item to its own node.');
      return;
    }

    // Keep taxonomy as a tree: a target node cannot be linked from multiple parents.
    const existingParent = this.nodes.find(n =>
      n.choices.some(c =>
        c.targetNodeId === targetNode.id &&
        !(n.id === sourceNode.id && c.id === sourceChoice.id)
      )
    );
    if (existingParent) {
      this.cancelWire(`Node #${targetNode.id} is already linked from #${existingParent.id}. Remove that link first.`);
      return;
    }

    sourceChoice.targetNodeId = targetNode.id;
    this.selectedNodeId = sourceNode.id;
    this.recomputeRootFlags();
    this.cancelWire(`Linked "${sourceChoice.label}" to #${targetNode.id}.`);
    this.requestMapRefresh();
  }

  cancelWire(message = 'Wiring canceled.'): void {
    this.wireFromChoice = null;
    this.statusMessage = message;
    this.requestMapRefresh();
  }

  // Adds an unlinked child item under the current node; you can wire it manually.
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
    this.statusMessage = 'Item added. Use the + on the map to link it.';
    this.requestMapRefresh();
  }

  // Main workflow: create the next-level node and link it.
  addChild(): void {
    const parent = this.selectedNode;
    const label = this.newChoiceLabel.trim();
    if (!parent || !label) {
      return;
    }

    const parentKind = this.getNodeKind(parent.id);
    if (parentKind === 'choice') {
      this.statusMessage = 'Cannot add children to a Choice. Choices must be leaf tags.';
      return;
    }
    if (parentKind === 'invalid') {
      this.statusMessage = 'Cannot add child: selected node is invalid (cycle/depth issue).';
      return;
    }

    const childNode: BuilderNode = {
      id: this.nextNodeId++,
      title: label,
      content: '',
      isStart: false,
      x: parent.x + 360,
      y: parent.y + Math.max(0, parent.choices.length) * 160,
      choices: [],
      isPersisted: false
    };
    this.nodes.push(childNode);

    const nextOrder = parent.choices.length + 1;
    parent.choices.push({
      id: this.nextChoiceId++,
      label,
      targetNodeId: childNode.id,
      displayOrder: nextOrder,
      isPersisted: false
    });

    this.newChoiceLabel = '';
    this.selectedNodeId = childNode.id;
    this.recomputeRootFlags();

    const childKind = this.getNodeKind(childNode.id);
    this.statusMessage = `${this.getNodeKindLabel(childKind)} "${label}" created and linked.`;
    this.requestMapRefresh();
  }

  // Backward compat for older template bindings.
  addSubcategory(): void {
    this.addChild();
  }

  removeChoice(choiceId: number): void {
    const node = this.selectedNode;
    if (!node) return;
    node.choices = node.choices.filter(c => c.id !== choiceId);
    this.recomputeRootFlags();
    this.statusMessage = 'Item removed.';
    this.requestMapRefresh();
  }

  getSelectedNodeKind(): CaseTagNodeKind {
    if (!this.selectedNodeId) {
      return 'invalid';
    }
    return this.getNodeKind(this.selectedNodeId);
  }

  getNodeKind(nodeId: number): CaseTagNodeKind {
    const parentByTarget = this.getParentMapFromCurrentGraph();
    const { depth, hasCycle } = this.getDepthForNode(nodeId, parentByTarget);
    if (hasCycle || depth < 0) {
      return 'invalid';
    }
    if (depth === 0) return 'category';
    if (depth === 1) return 'subcategory';
    if (depth === 2) return 'subdivision';
    if (depth === 3) return 'choice';
    return 'invalid';
  }

  getNodeKindLabel(kindOrNodeId: CaseTagNodeKind | number): string {
    const kind = typeof kindOrNodeId === 'number' ? this.getNodeKind(kindOrNodeId) : kindOrNodeId;
    switch (kind) {
      case 'category':
        return 'Category';
      case 'subcategory':
        return 'Subcategory';
      case 'subdivision':
        return 'Sub-division';
      case 'choice':
        return 'Choice';
      default:
        return 'Invalid';
    }
  }

  getChildCollectionLabelForKind(kindOrNodeId: CaseTagNodeKind | number): string {
    const kind = typeof kindOrNodeId === 'number' ? this.getNodeKind(kindOrNodeId) : kindOrNodeId;
    switch (kind) {
      case 'category':
        return 'Subcategories';
      case 'subcategory':
        return 'Sub-divisions';
      case 'subdivision':
        return 'Choices';
      case 'choice':
        return 'Choices';
      default:
        return 'Children';
    }
  }

  getChildPlaceholderForKind(kindOrNodeId: CaseTagNodeKind | number): string {
    const kind = typeof kindOrNodeId === 'number' ? this.getNodeKind(kindOrNodeId) : kindOrNodeId;
    switch (kind) {
      case 'category':
        return 'Subcategory label';
      case 'subcategory':
        return 'Sub-division label';
      case 'subdivision':
        return 'Choice label';
      default:
        return 'Label';
    }
  }

  getAddChildButtonLabelForKind(kindOrNodeId: CaseTagNodeKind | number): string {
    const kind = typeof kindOrNodeId === 'number' ? this.getNodeKind(kindOrNodeId) : kindOrNodeId;
    switch (kind) {
      case 'category':
        return 'Add Subcategory';
      case 'subcategory':
        return 'Add Sub-division';
      case 'subdivision':
        return 'Add Choice';
      case 'choice':
        return 'Choice is a leaf';
      default:
        return 'Add Child';
    }
  }

  onNodeEdited(): void {
    this.nodes = [...this.nodes];
    this.recomputeRootFlags();
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

  private async loadMap(): Promise<void> {
    this.isLoading = true;
    this.statusMessage = 'Loading case tag map...';
    this.lastSaveErrorDetails = '';

    try {
      const map = await firstValueFrom(this.caseTagsService.getMap());
      this.applyMap(map);
      this.statusMessage = 'Case tag map loaded.';
    } catch {
      this.nodes = [];
      this.selectedNodeId = null;
      this.nextNodeId = 1000;
      this.nextChoiceId = 5000;
      this.addCategory();
      this.statusMessage = 'No case tag map found. Started a new draft.';
    } finally {
      this.isLoading = false;
      this.requestMapRefresh();
    }
  }

  private applyMap(map: CaseTagMap): void {
    const rawNodes = Array.isArray(map.nodes) ? map.nodes : [];
    const rawEdges = Array.isArray(map.edges) ? map.edges : [];

    const edgesBySource = new Map<number, CaseTagEdge[]>();
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
          label: edge.label || `Item ${edgeIndex + 1}`,
          targetNodeId: edge.targetNodeId,
          displayOrder: edge.displayOrder ?? edgeIndex,
          isPersisted: true
        }));

      return {
        id: nodeId,
        title: node.label || `Tag ${nodeId}`,
        content: node.content || '',
        isStart: !!node.isStart,
        x: typeof node.xPos === 'number' ? node.xPos : 120 + (index % 4) * 280,
        y: typeof node.yPos === 'number' ? node.yPos : 80 + Math.floor(index / 4) * 180,
        choices: edgeChoices,
        isPersisted: true
      } as BuilderNode;
    });

    if (!this.nodes.length) {
      this.addCategory();
    }

    this.recomputeRootFlags();

    const maxNodeId = Math.max(...this.nodes.map(n => n.id));
    const maxChoiceId = Math.max(0, ...this.nodes.flatMap(n => n.choices.map(c => c.id)));
    this.nextNodeId = Math.max(1000, maxNodeId + 1);
    this.nextChoiceId = Math.max(5000, maxChoiceId + 1);

    this.selectedNodeId = this.nodes.find(n => n.isStart)?.id ?? this.nodes[0].id;
    this.autoLayout();
  }

  private buildSavePayload(): CaseTagMapSavePayload {
    // Persist computed roots as `isStart` so clients can reliably detect Categories.
    this.recomputeRootFlags();

    const nodes: CaseTagNode[] = this.nodes.map(node => ({
      id: node.id,
      label: node.title,
      content: node.content,
      xPos: Math.round(node.x),
      yPos: Math.round(node.y),
      isStart: node.isStart
    }));

    const edges: CaseTagEdge[] = [];
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

    return { nodes, edges };
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

  private getParentMapFromCurrentGraph(): Map<number, number> {
    const parentByTarget = new Map<number, number>();
    for (const source of this.nodes) {
      for (const choice of source.choices) {
        if (!choice.targetNodeId) continue;
        if (!parentByTarget.has(choice.targetNodeId)) {
          parentByTarget.set(choice.targetNodeId, source.id);
        }
      }
    }
    return parentByTarget;
  }

  private getRootIdsFromCurrentGraph(): number[] {
    const parentByTarget = this.getParentMapFromCurrentGraph();
    return this.nodes
      .map(n => n.id)
      .filter(id => !parentByTarget.has(id));
  }

  private recomputeRootFlags(): void {
    if (!this.nodes.length) {
      return;
    }
    const rootIds = new Set<number>(this.getRootIdsFromCurrentGraph());
    for (const node of this.nodes) {
      node.isStart = rootIds.has(node.id);
    }
  }

  private getDepthForNode(nodeId: number, parentByTarget: Map<number, number>): { depth: number; hasCycle: boolean } {
    let depth = 0;
    let current = nodeId;
    const guard = new Set<number>();

    while (parentByTarget.has(current)) {
      if (guard.has(current)) {
        return { depth: -1, hasCycle: true };
      }
      guard.add(current);
      current = parentByTarget.get(current)!;
      depth += 1;
      if (depth > 50) {
        return { depth, hasCycle: true };
      }
    }

    return { depth, hasCycle: false };
  }
}
