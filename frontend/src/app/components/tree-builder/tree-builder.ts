import { CommonModule } from '@angular/common';
import { ApplicationRef, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Page, PageService, TreePageSavePayload, TreeSaveResponse } from '../../services/page';

interface TreeChoice {
  id: number;
  label: string;
  targetPageId: number | null;
  displayOrder: number;
  isPersisted: boolean;
}

interface TreeNode {
  id: number;
  name: string;
  content: string;
  tag: string;
  isStart: boolean;
  x: number;
  y: number;
  choices: TreeChoice[];
  isPersisted: boolean;
}

@Component({
  selector: 'app-tree-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tree-builder.html',
  styleUrls: ['./tree-builder.css']
})
export class TreeBuilder implements OnInit {
  private static readonly TEMP_TAG_PREFIX = '__TREE_TMP_ID__:';
  private static readonly TEMP_CONTENT_PREFIX = '__TREE_TMP_CONTENT_ID__:';
  private static readonly TEMP_NAME_PREFIX = '__TREE_TMP_NAME_ID__:';

  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLDivElement>;
  @ViewChildren('choiceWireBtn') choiceWireButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  nodes: TreeNode[] = [];
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
  saveStage = '';
  lastSaveErrorDetails = '';
  lastSaveDebugDetails = '';
  isLoading = false;
  isSaving = false;
  sqlOutput = '';
  newChoiceLabel = '';

  constructor(
    private pageService: PageService,
    private cdr: ChangeDetectorRef,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    void this.loadExistingTree();
  }

  get selectedNode(): TreeNode | undefined {
    return this.nodes.find(n => n.id === this.selectedNodeId);
  }

  addNode(): void {
    const node: TreeNode = {
      id: this.nextNodeId++,
      name: `New Page ${this.nextNodeId - 1}`,
      content: '<p>Describe this step...</p>',
      tag: '',
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

  async reloadFromMagicAssistance(): Promise<void> {
    await this.loadExistingTree();
  }

  async saveToDatabase(): Promise<void> {
    if (!this.nodes.length) {
      this.statusMessage = 'Nothing to save.';
      return;
    }

    const firstUnlinked = this.nodes.find(node => node.choices.some(choice => !choice.targetPageId));
    if (firstUnlinked) {
      this.selectedNodeId = firstUnlinked.id;
      this.statusMessage = `Please link all choices before saving. Node #${firstUnlinked.id} has unlinked choices.`;
      return;
    }

    this.isSaving = true;
    this.saveStage = 'init';
    this.lastSaveErrorDetails = '';
    this.lastSaveDebugDetails = '';
    this.statusMessage = 'Saving to database...';

    try {
      this.saveStage = 'snapshot';
      const snapshot = this.cloneNodes(this.nodes);
      const hasNewPages = snapshot.some(node => !node.isPersisted);
      const newNodesOrdered = snapshot.filter(node => !node.isPersisted);

      if (!hasNewPages) {
        this.saveStage = 'single-save';
        const payload = this.buildSavePayload(snapshot);
        const result = await firstValueFrom(this.pageService.saveTree(payload));
        this.statusMessage = `Saved to DB (${result.savedPages} page(s)).`;
        this.saveStage = 'reload';
        await this.loadExistingTree();
        this.saveStage = 'done';
        return;
      }

      this.saveStage = 'before-map';
      const pagesBeforeCreate = await this.fetchAllPagesForMapping();
      const beforeIds = new Set(Array.from(pagesBeforeCreate.keys()));
      let stage1SavedPages: number | 'n/a' = 'n/a';

      // Step 1: create only new pages. Do not touch existing pages/choices.
      this.saveStage = 'create-new-pages';
      const stage1Payload = snapshot
        .filter(node => !node.isPersisted)
        .map(node => ({
        id: null,
        name: this.addTempNameMarker(node.name, node.id),
        content: this.addTempContentMarker(node.content, node.id),
        tag: this.addTempTagMarker(node.tag, node.id),
        prevPageId: null,
        isStart: node.isStart,
        choices: []
      }));

      const stage1Result: TreeSaveResponse = await firstValueFrom(this.pageService.saveTree(stage1Payload));
      stage1SavedPages = stage1Result?.savedPages ?? 'n/a';

      this.saveStage = 'after-map';
      const tempIdToRealId = new Map<number, number>();

      // First, use backend-provided id map if available.
      const backendIdMap = stage1Result?.idMap ?? {};
      for (const [rawKey, rawValue] of Object.entries(backendIdMap)) {
        const from = Number(rawKey);
        const to = Number(rawValue);
        if (Number.isFinite(from) && Number.isFinite(to) && to > 0) {
          tempIdToRealId.set(from, to);
        }
      }

      const allPagesForMapping = await this.fetchAllPagesForMapping();
      for (const page of allPagesForMapping.values()) {
        const tempId =
          this.extractTempNameMarker(page.name || '') ??
          this.extractTempTagMarker(page.tag || '') ??
          this.extractTempContentMarker(page.content || '');
        if (tempId !== null) {
          tempIdToRealId.set(tempId, page.id);
        }
      }

      const unresolvedNewNodes = newNodesOrdered.filter(node => !tempIdToRealId.has(node.id));
      if (unresolvedNewNodes.length > 0) {
        // Fallback: infer created pages by id diff before/after stage 1.
        const createdIds = Array.from(allPagesForMapping.keys())
          .filter(id => !beforeIds.has(id))
          .sort((a, b) => a - b);
        const alreadyMapped = new Set(Array.from(tempIdToRealId.values()));
        const candidateIds = createdIds.filter(id => !alreadyMapped.has(id));

        for (let i = 0; i < unresolvedNewNodes.length && i < candidateIds.length; i++) {
          tempIdToRealId.set(unresolvedNewNodes[i].id, candidateIds[i]);
        }

        const stillUnresolved = newNodesOrdered.filter(node => !tempIdToRealId.has(node.id));
        if (stillUnresolved.length > 0) {
          this.lastSaveDebugDetails = [
            `beforeCount: ${beforeIds.size}`,
            `afterCount: ${allPagesForMapping.size}`,
            `stage1SavedPages: ${stage1SavedPages}`,
            `newNodesOrdered: [${newNodesOrdered.map(n => `${n.id}:${n.name}`).join(', ')}]`,
            `createdIds(diff): [${createdIds.join(', ')}]`,
            `mappedPairs: [${Array.from(tempIdToRealId.entries()).map(([k, v]) => `${k}->${v}`).join(', ')}]`
          ].join('\n');
          throw new Error(
            `Backend did not return enough data to map new page ids (${stillUnresolved
              .map(n => `"${n.name}"`)
              .join(', ')}).`
          );
        }
      }

      const finalNodes = snapshot.map(node => {
        const mappedNodeId = tempIdToRealId.get(node.id) ?? (node.isPersisted ? node.id : null);
        if (mappedNodeId === null) {
          throw new Error(`Could not resolve saved id for page "${node.name}".`);
        }

        return {
          ...node,
          id: mappedNodeId,
          isPersisted: true,
          name: this.removeTempNameMarker(node.name),
          tag: this.removeTempTagMarker(node.tag),
          content: this.removeTempContentMarker(node.content),
          choices: node.choices.map(choice => ({
            ...choice,
            targetPageId: choice.targetPageId === null
              ? null
              : (tempIdToRealId.get(choice.targetPageId) ?? choice.targetPageId),
            isPersisted: false
          }))
        } as TreeNode;
      });

      this.saveStage = 'final-save';
      const finalPayload = this.buildSavePayload(finalNodes);
      const finalResult = await firstValueFrom(this.pageService.saveTree(finalPayload));
      this.statusMessage = `Saved to DB (${finalResult.savedPages} page(s)).`;
      this.saveStage = 'reload';
      await this.loadExistingTree();
      this.saveStage = 'done';
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
      } else if (apiMessage || genericMessage) {
        this.statusMessage = `Failed to save: ${apiMessage || genericMessage}`;
      } else {
        this.statusMessage = 'Failed to save tree to database.';
      }
      const errorBody =
        httpError?.error === undefined
          ? ''
          : typeof httpError.error === 'string'
            ? httpError.error
            : JSON.stringify(httpError.error, null, 2);
      this.lastSaveErrorDetails = [
        `stage: ${this.saveStage || 'unknown'}`,
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
        (error as Error)?.stack || '(no stack)',
        '',
        'debug:',
        this.lastSaveDebugDetails || '(none)'
      ].join('\n');
      console.error('Save tree failed', error);
    } finally {
      this.isSaving = false;
      this.requestMapRefresh();
    }
  }

  private buildSavePayload(nodes: TreeNode[]): TreePageSavePayload[] {
    const prevPageMap = this.computePrevPageMap(nodes);

    return nodes.map(node => ({
      id: node.isPersisted ? node.id : null,
      name: this.removeTempNameMarker(node.name),
      content: this.removeTempContentMarker(node.content),
      tag: this.removeTempTagMarker(node.tag),
      prevPageId: node.isStart ? null : (prevPageMap.get(node.id) ?? null),
      isStart: node.isStart,
      choices: node.choices.map(choice => ({
        id: null,
        label: choice.label,
        targetPageId: choice.targetPageId as number,
        displayOrder: choice.displayOrder
      }))
    }));
  }

  private cloneNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.map(node => ({
      ...node,
      choices: node.choices.map(choice => ({ ...choice }))
    }));
  }

  private addTempTagMarker(tag: string, tempId: number): string {
    const clean = this.removeTempTagMarker(tag);
    const marker = `${TreeBuilder.TEMP_TAG_PREFIX}${tempId}`;
    return clean ? `${clean} ${marker}` : marker;
  }

  private extractTempTagMarker(tag: string): number | null {
    const regex = new RegExp(`${TreeBuilder.TEMP_TAG_PREFIX}(\\d+)`);
    const match = (tag || '').match(regex);
    return match ? Number(match[1]) : null;
  }

  private removeTempTagMarker(tag: string): string {
    const regex = new RegExp(`\\s*${TreeBuilder.TEMP_TAG_PREFIX}\\d+\\s*`, 'g');
    return (tag || '').replace(regex, ' ').replace(/\s+/g, ' ').trim();
  }

  private addTempContentMarker(content: string, tempId: number): string {
    const clean = this.removeTempContentMarker(content);
    const marker = `<!--${TreeBuilder.TEMP_CONTENT_PREFIX}${tempId}-->`;
    return `${clean}\n${marker}`;
  }

  private extractTempContentMarker(content: string): number | null {
    const regex = new RegExp(`<!--${TreeBuilder.TEMP_CONTENT_PREFIX}(\\d+)-->`);
    const match = (content || '').match(regex);
    return match ? Number(match[1]) : null;
  }

  private removeTempContentMarker(content: string): string {
    const regex = new RegExp(`\\s*<!--${TreeBuilder.TEMP_CONTENT_PREFIX}\\d+-->\\s*`, 'g');
    return (content || '').replace(regex, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private addTempNameMarker(name: string, tempId: number): string {
    const clean = this.removeTempNameMarker(name);
    return `${clean} [${TreeBuilder.TEMP_NAME_PREFIX}${tempId}]`;
  }

  private extractTempNameMarker(name: string): number | null {
    const regex = new RegExp(`\\[${TreeBuilder.TEMP_NAME_PREFIX}(\\d+)\\]`);
    const match = (name || '').match(regex);
    return match ? Number(match[1]) : null;
  }

  private removeTempNameMarker(name: string): string {
    const regex = new RegExp(`\\s*\\[${TreeBuilder.TEMP_NAME_PREFIX}\\d+\\]\\s*`, 'g');
    return (name || '').replace(regex, ' ').replace(/\s+/g, ' ').trim();
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
        if (!choice.targetPageId) continue;
        if (!visited.has(choice.targetPageId)) {
          queue.push({ id: choice.targetPageId, level: current.level + 1 });
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

    const byLevel = new Map<number, TreeNode[]>();
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
      .map(n => ({ ...n, choices: n.choices.filter(c => c.targetPageId !== id) }));
    this.selectedNodeId = this.nodes[0]?.id ?? null;
    this.statusMessage = 'Node deleted.';
    this.requestMapRefresh();
  }

  selectNode(nodeId: number): void {
    this.selectedNodeId = nodeId;
    this.requestMapRefresh();
  }

  startDrag(event: MouseEvent, node: TreeNode): void {
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

  startChoiceWire(event: MouseEvent, sourceNode: TreeNode, choice: TreeChoice): void {
    event.preventDefault();
    event.stopPropagation();
    const { x, y } = this.getCanvasPoint(event);
    this.wireFromChoice = { sourceNodeId: sourceNode.id, choiceId: choice.id };
    this.wireMouseX = x;
    this.wireMouseY = y;
    this.statusMessage = `Rewiring choice "${choice.label}" from #${sourceNode.id}: drop on a target node.`;
  }

  completeWire(event: MouseEvent, targetNode: TreeNode): void {
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
      this.cancelWire('Cannot link a choice to its own page.');
      return;
    }

    sourceChoice.targetPageId = targetNode.id;
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
      targetPageId: null,
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
    this.nodes.forEach(n => n.isStart = n.id === nodeId);
    this.statusMessage = `Node ${nodeId} set as start page.`;
    this.requestMapRefresh();
  }

  onNodeEdited(): void {
    this.nodes = [...this.nodes];
    this.requestMapRefresh();
  }

  exportSql(): void {
    const prevPageMap = this.computePrevPageMap(this.nodes);

    const pageLines = this.nodes.map((n) => {
      const safeName = this.escapeSql(n.name);
      const safeContent = this.escapeSql(n.content);
      const safeTag = n.tag?.trim() ? `'${this.escapeSql(n.tag)}'` : 'NULL';
      const isStart = n.isStart ? 1 : 0;
      const prevPageId = n.isStart ? null : (prevPageMap.get(n.id) ?? null);
      const prevSql = prevPageId === null ? 'NULL' : String(prevPageId);
      return `(${n.id}, '${safeName}', '${safeContent}', ${safeTag}, ${prevSql}, ${isStart})`;
    });

    const allChoices = this.nodes.flatMap(n =>
      n.choices.map(c =>
        `(${c.id}, '${this.escapeSql(c.label)}', ${n.id}, ${c.targetPageId ?? 'NULL'}, ${c.displayOrder})`
      )
    );

    this.sqlOutput = [
      '-- Pages',
      'INSERT INTO pages (id, name, content, tag, prev_page_id, is_start) VALUES',
      pageLines.join(',\n') + ';',
      '',
      '-- Choices',
      allChoices.length
        ? 'INSERT INTO choices (id, label, source_page_id, target_page_id, display_order) VALUES\n' + allChoices.join(',\n') + ';'
        : '-- No choices yet.'
    ].join('\n');

    this.statusMessage = 'SQL generated.';
  }

  copySql(): void {
    if (!this.sqlOutput) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.sqlOutput);
      this.statusMessage = 'SQL copied.';
    }
  }

  saveSqlFile(): void {
    if (!this.sqlOutput.trim()) {
      this.exportSql();
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const blob = new Blob([this.sqlOutput], { type: 'text/sql;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    anchor.href = url;
    anchor.download = `magic-assistance-tree-${stamp}.sql`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
    this.statusMessage = 'SQL file saved.';
  }

  private async loadExistingTree(): Promise<void> {
    this.isLoading = true;
    this.statusMessage = 'Loading existing Magic Assistance flow...';

    const pageMap = new Map<number, Page>();
    try {
      const response = await firstValueFrom(this.pageService.getAllPages());
      const pages = Array.isArray(response)
        ? response
        : (response && Array.isArray((response as { pages?: Page[] }).pages))
          ? (response as { pages: Page[] }).pages
          : [];
      for (const page of pages) {
        pageMap.set(page.id, page);
      }
    } catch {
      const startCandidates = [1];
      for (const startId of startCandidates) {
        await this.fetchGraphFrom(startId, pageMap);
      }
    }

    if (pageMap.size === 0) {
      this.nodes = [];
      this.addNode();
      this.statusMessage = 'No existing flow found. Started a new draft node.';
      this.isLoading = false;
      return;
    }

    const pages = Array.from(pageMap.values()).sort((a, b) => a.id - b.id);

    this.nodes = pages.map((p, index) => ({
      id: p.id,
      name: p.name || `Page ${p.id}`,
      content: p.content || '<p></p>',
      tag: p.tag || '',
      isStart: !!p.isStart,
      x: 120 + (index % 4) * 280,
      y: 80 + Math.floor(index / 4) * 180,
      choices: (p.choices || []).map(c => ({
        id: c.id,
        label: c.label,
        targetPageId: c.targetPageId,
        displayOrder: c.displayOrder ?? 0,
        isPersisted: true
      })),
      isPersisted: true
    }));

    const hasStart = this.nodes.some(n => n.isStart);
    if (!hasStart && this.nodes.length > 0) {
      const first = this.nodes.find(n => n.id === 1) || this.nodes[0];
      first.isStart = true;
    }

    const maxNodeId = Math.max(...this.nodes.map(n => n.id));
    const maxChoiceId = Math.max(0, ...this.nodes.flatMap(n => n.choices.map(c => c.id)));
    this.nextNodeId = maxNodeId + 1;
    this.nextChoiceId = maxChoiceId + 1;

    this.selectedNodeId = this.nodes.find(n => n.isStart)?.id ?? this.nodes[0].id;
    this.autoLayout();
    this.statusMessage = `Loaded ${this.nodes.length} page(s) from Magic Assistance.`;
    this.isLoading = false;
    this.requestMapRefresh();
  }

  private async fetchAllPagesForMapping(): Promise<Map<number, Page>> {
    const pageMap = new Map<number, Page>();

    try {
      const response = await firstValueFrom(this.pageService.getAllPages());
      const pages = Array.isArray(response)
        ? response
        : (response && Array.isArray((response as { pages?: Page[] }).pages))
          ? (response as { pages: Page[] }).pages
          : [];

      for (const page of pages) {
        pageMap.set(page.id, page);
      }
    } catch {
      // Fallback to graph-based load when all-pages endpoint is unavailable.
      await this.loadExistingTree();
      for (const node of this.nodes) {
        pageMap.set(node.id, {
          id: node.id,
          name: node.name,
          content: node.content,
          tag: node.tag,
          prevPageId: undefined,
          isStart: node.isStart,
          choices: []
        });
      }
    }

    return pageMap;
  }

  private async fetchGraphFrom(startId: number, pageMap: Map<number, Page>): Promise<void> {
    const queue: number[] = [startId];
    const seen = new Set<number>();

    while (queue.length > 0) {
      const pageId = queue.shift()!;
      if (seen.has(pageId) || pageMap.has(pageId)) continue;
      seen.add(pageId);

      try {
        const page = await firstValueFrom(this.pageService.getPage(pageId));
        pageMap.set(page.id, page);
        for (const choice of page.choices || []) {
          if (!seen.has(choice.targetPageId)) {
            queue.push(choice.targetPageId);
          }
        }
      } catch {
        // ignore missing/unreachable pages in candidate branches
      }
    }
  }

  private escapeSql(value: string): string {
    return (value || '').replace(/'/g, "''");
  }

  private computePrevPageMap(nodes: TreeNode[]): Map<number, number | null> {
    const prevMap = new Map<number, number | null>();
    const nodeIds = new Set(nodes.map(n => n.id));

    for (const node of nodes) {
      prevMap.set(node.id, null);
    }

    const orderedSources = [...nodes].sort((a, b) => a.id - b.id);
    for (const source of orderedSources) {
      const orderedChoices = [...source.choices].sort((a, b) => {
        const ao = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
        return ao - bo;
      });

      for (const choice of orderedChoices) {
        const targetId = choice.targetPageId;
        if (!targetId || !nodeIds.has(targetId) || targetId === source.id) {
          continue;
        }

        // Keep first incoming source as prev_page_id for deterministic output.
        if (prevMap.get(targetId) === null) {
          prevMap.set(targetId, source.id);
        }
      }
    }

    for (const node of nodes) {
      if (node.isStart) {
        prevMap.set(node.id, null);
      }
    }

    return prevMap;
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

  getWorldWidth(): number {
    const canvasWidth = this.canvasRef?.nativeElement.clientWidth ?? 1200;
    const maxNodeRight = this.nodes.length
      ? Math.max(...this.nodes.map(node => node.x + 420))
      : 0;
    return Math.max(canvasWidth + 800, maxNodeRight + 800, 2200);
  }

  getWorldHeight(): number {
    const canvasHeight = this.canvasRef?.nativeElement.clientHeight ?? 700;
    const maxNodeBottom = this.nodes.length
      ? Math.max(...this.nodes.map(node => node.y + this.getEstimatedNodeHeight(node) + 220))
      : 0;
    return Math.max(canvasHeight + 800, maxNodeBottom, 1600);
  }

  getCanvasBackgroundSize(): string {
    const grid = 32 * this.canvasZoom;
    return `${grid}px ${grid}px`;
  }

  getCanvasBackgroundPosition(): string {
    return `${this.canvasPanX}px ${this.canvasPanY}px`;
  }

  getNodeById(id: number): TreeNode | undefined {
    return this.nodes.find(n => n.id === id);
  }

  private getEstimatedNodeHeight(node: TreeNode): number {
    const baseHeight = 128;
    const choicesHeight = node.choices.length > 0
      ? (54 + node.choices.length * 30)
      : 0;
    const startHeight = node.isStart ? 24 : 0;
    return baseHeight + choicesHeight + startHeight;
  }

  private getChoiceAnchor(source: TreeNode, choice: TreeChoice): { x: number; y: number } {
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

  getConnectionPath(source: TreeNode, choice: TreeChoice): string {
    if (!choice.targetPageId) return '';
    const target = this.getNodeById(choice.targetPageId);
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
