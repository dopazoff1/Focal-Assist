import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, firstValueFrom } from 'rxjs';
import {
  ChatProject,
  ChatQueue,
  ChatUser,
  ChatWorkflow,
  LiveChatPlatformService,
  WorkflowConnection,
  WorkflowNode
} from '../../services/live-chat-platform';

type ProjectTab = 'overview' | 'workflow' | 'queues' | 'api';
type BranchKind = 'choice' | 'text' | 'boolean' | 'next';

interface WorkflowBranch {
  key: string;
  label: string;
  kind: BranchKind;
}

interface WireDrag {
  node: WorkflowNode;
  branch: WorkflowBranch;
  x: number;
  y: number;
  pointerId: number;
}

@Component({
  selector: 'app-chat-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-projects.html',
  styleUrls: ['./chat-projects.css']
})
export class ChatProjectsComponent implements OnInit {
  projects: ChatProject[] = [];
  selected?: ChatProject;
  selectedDetails: any;
  workflow: ChatWorkflow = { status: 'DRAFT', version: 1, nodes: [], connections: [] };
  queues: ChatQueue[] = [];
  users: ChatUser[] = [];
  tab: ProjectTab = 'overview';
  search = '';
  loading = false;
  saving = false;
  message = '';
  newProject: Partial<ChatProject> = { name: '', description: '', brandColor: '#3157ff', welcomeMessage: 'Hi. How can we help?' };
  newQueue: Partial<ChatQueue> = { name: '', color: '#3157ff', priority: 1 };
  selectedNode?: WorkflowNode;
  wireFrom?: { node: WorkflowNode; branch: WorkflowBranch };
  wireDrag?: WireDrag;
  scale = 1;
  panX = 0;
  panY = 0;
  isPanningCanvas = false;
  panStartX = 0;
  panStartY = 0;
  panOriginX = 0;
  panOriginY = 0;
  draggingNode?: WorkflowNode;
  dragOffsetX = 0;
  dragOffsetY = 0;
  dragCanvasLeft = 0;
  dragCanvasTop = 0;
  apiToken = '';

  readonly nodeTypes = [
    { type: 'START', label: 'Start' },
    { type: 'CHOICE_RESPONSE', label: 'Bot choices' },
    { type: 'TEXT_ENTRY', label: 'Text entry' },
    { type: 'BOOLEAN_RESPONSE', label: 'Boolean' },
    { type: 'MESSAGE', label: 'Message' },
    { type: 'QUEUE_ROUTING', label: 'Queue routing' },
    { type: 'ESCALATE_TO_AGENT', label: 'Escalate' },
    { type: 'END', label: 'End' }
  ];

  constructor(private chat: LiveChatPlatformService) {}

  ngOnInit(): void {
    void this.reload();
    this.chat.listAssignableUsers().subscribe({
      next: users => this.users = users.filter(user => user.active),
      error: () => this.users = []
    });
  }

  async reload(): Promise<void> {
    this.loading = true;
    try {
      this.projects = await firstValueFrom(this.chat.listProjects(this.search));
      if (this.selected) {
        const match = this.projects.find(project => project.id === this.selected?.id);
        if (match) await this.selectProject(match);
      } else if (this.projects.length) {
        await this.selectProject(this.projects[0]);
      }
    } finally {
      this.loading = false;
    }
  }

  async selectProject(project: ChatProject): Promise<void> {
    this.selected = project;
    this.selectedDetails = await firstValueFrom(this.chat.getProject(project.id));
    this.workflow = this.normalizeWorkflow(this.selectedDetails.workflow);
    this.queues = this.selectedDetails.queues || [];
    if (!this.workflow.nodes.length) this.seedWorkflow();
    this.selectedNode = this.workflow.nodes[0];
    this.apiToken = '';
  }

  createProject(): void {
    if (!this.newProject.name?.trim()) return;
    this.saving = true;
    this.chat.createProject(this.newProject).pipe(finalize(() => this.saving = false)).subscribe({
      next: async project => {
        this.newProject = { name: '', description: '', brandColor: '#3157ff', welcomeMessage: 'Hi. How can we help?' };
        this.flash('Project created.');
        await this.reload();
        await this.selectProject(project);
      },
      error: err => this.flash(err?.error?.message || 'Project creation failed.')
    });
  }

  saveProject(): void {
    if (!this.selected) return;
    this.saving = true;
    this.chat.updateProject(this.selected.id, this.selected).pipe(finalize(() => this.saving = false)).subscribe({
      next: async project => {
        this.flash('Project saved.');
        await this.reload();
        await this.selectProject(project);
      },
      error: err => this.flash(err?.error?.message || 'Project save failed.')
    });
  }

  activateProject(): void {
    if (!this.selected) return;
    this.chat.activateProject(this.selected.id).subscribe({ next: () => void this.reload() });
  }

  archiveProject(): void {
    if (!this.selected) return;
    if (!confirm(`Archive ${this.selected.name}?`)) return;
    this.chat.archiveProject(this.selected.id).subscribe({ next: () => void this.reload() });
  }

  duplicateProject(): void {
    if (!this.selected) return;
    this.chat.duplicateProject(this.selected.id).subscribe({ next: () => void this.reload() });
  }

  deleteProject(): void {
    if (!this.selected) return;
    if (!confirm(`Delete ${this.selected.name}? This cannot be undone.`)) return;
    this.chat.deleteProject(this.selected.id).subscribe({
      next: () => {
        this.selected = undefined;
        this.selectedDetails = undefined;
        void this.reload();
      }
    });
  }

  addNode(type: string): void {
    const id = `${type.toLowerCase()}-${Date.now()}`;
    const node: WorkflowNode = {
      clientNodeId: id,
      type,
      title: this.nodeTypeLabel(type),
      x: 260 + this.workflow.nodes.length * 32,
      y: 200 + this.workflow.nodes.length * 26,
      properties: this.defaultPropertiesFor(type)
    };
    this.workflow.nodes = [...this.workflow.nodes, node];
    this.selectedNode = node;
  }

  duplicateNode(node: WorkflowNode): void {
    const copy: WorkflowNode = {
      ...node,
      clientNodeId: `${node.clientNodeId}-copy-${Date.now()}`,
      title: `${node.title} copy`,
      x: node.x + 50,
      y: node.y + 50,
      properties: { ...(node.properties || {}) }
    };
    this.workflow.nodes = [...this.workflow.nodes, copy];
    this.selectedNode = copy;
  }

  deleteNode(node: WorkflowNode): void {
    if (node.type === 'START') return;
    this.workflow.nodes = this.workflow.nodes.filter(item => item !== node);
    this.workflow.connections = this.workflow.connections.filter(edge => edge.sourceNodeId !== node.clientNodeId && edge.targetNodeId !== node.clientNodeId);
    this.selectedNode = this.workflow.nodes[0];
  }

  handleNodeClick(event: MouseEvent, node: WorkflowNode): void {
    event.stopPropagation();
    if (this.draggingNode) return;
    if (this.wireFrom && this.wireFrom.node.clientNodeId !== node.clientNodeId) {
      this.completeBranchWire(node);
      return;
    }
    this.selectedNode = node;
  }

  startBranchWire(event: MouseEvent, node: WorkflowNode, branch: WorkflowBranch): void {
    event.stopPropagation();
    this.wireFrom = { node, branch };
    this.selectedNode = node;
    this.flash(`Select the target node for "${branch.label}".`);
  }

  completeBranchWire(target: WorkflowNode): void {
    if (!this.wireFrom) return;
    const { node, branch } = this.wireFrom;
    this.workflow.connections = this.workflow.connections.filter(edge =>
      !(edge.sourceNodeId === node.clientNodeId && this.edgeBranchKey(edge) === branch.key)
    );
    this.workflow.connections = [
      ...this.workflow.connections,
      {
        sourceNodeId: node.clientNodeId,
        targetNodeId: target.clientNodeId,
        label: branch.label,
        sourceHandle: branch.key
      }
    ];
    this.wireFrom = undefined;
    this.selectedNode = target;
    this.flash(`Linked "${branch.label}" to ${target.title}.`);
  }

  cancelWire(): void {
    this.wireFrom = undefined;
    this.wireDrag = undefined;
  }

  removeConnection(edge: WorkflowConnection): void {
    this.workflow.connections = this.workflow.connections.filter(item => item !== edge);
  }

  saveWorkflow(): void {
    if (!this.selected) return;
    this.saving = true;
    this.chat.saveWorkflow(this.selected.id, { nodes: this.workflow.nodes, connections: this.workflow.connections })
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: workflow => {
          this.workflow = this.normalizeWorkflow(workflow);
          this.flash('Workflow draft saved.');
        },
        error: err => this.flash(err?.error?.message || 'Workflow save failed.')
      });
  }

  publishWorkflow(): void {
    if (!this.selected) return;
    this.chat.publishWorkflow(this.selected.id).subscribe({
      next: workflow => {
        this.workflow = this.normalizeWorkflow(workflow);
        this.flash('Workflow published.');
      },
      error: err => this.flash(err?.error?.message || 'Workflow publish failed.')
    });
  }

  createQueue(): void {
    if (!this.selected || !this.newQueue.name?.trim()) return;
    this.chat.createQueue(this.selected.id, this.newQueue).subscribe({
      next: queue => {
        this.queues = [...this.queues, queue];
        this.newQueue = { name: '', color: '#3157ff', priority: 1 };
        this.flash('Queue created.');
      },
      error: err => this.flash(err?.error?.message || 'Queue creation failed.')
    });
  }

  saveQueue(queue: ChatQueue): void {
    if (!this.selected) return;
    this.chat.updateQueue(this.selected.id, queue.id, queue).subscribe({
      next: saved => {
        this.queues = this.queues.map(item => item.id === saved.id ? saved : item);
        this.flash('Queue saved.');
      }
    });
  }

  toggleQueueAgent(queue: ChatQueue, userId: number, checked: boolean): void {
    if (!this.selected) return;
    const current = new Set(queue.agentIds || []);
    if (checked) current.add(userId); else current.delete(userId);
    this.chat.replaceQueueAgents(this.selected.id, queue.id, Array.from(current)).subscribe({
      next: saved => this.queues = this.queues.map(item => item.id === saved.id ? saved : item)
    });
  }

  rotateApiKey(): void {
    if (!this.selected) return;
    this.chat.rotateApiKey(this.selected.id).subscribe({
      next: res => {
        this.apiToken = res.token;
        this.flash('New API key generated. Copy it now; it will not be shown again.');
        void this.selectProject(this.selected!);
      }
    });
  }

  pointerDown(event: PointerEvent, node: WorkflowNode): void {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, select, .map-choice, .node-actions-inline')) return;
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).closest('.tree-canvas')?.getBoundingClientRect();
    this.dragCanvasLeft = rect?.left ?? 0;
    this.dragCanvasTop = rect?.top ?? 0;
    this.draggingNode = node;
    this.selectedNode = node;
    this.dragOffsetX = (event.clientX - this.dragCanvasLeft - this.panX) / this.scale - node.x;
    this.dragOffsetY = (event.clientY - this.dragCanvasTop - this.panY) / this.scale - node.y;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  pointerMove(event: PointerEvent): void {
    if (this.wireDrag) {
      this.updateWireDrag(event);
      return;
    }
    if (!this.draggingNode) return;
    this.draggingNode.x = Math.round((event.clientX - this.dragCanvasLeft - this.panX) / this.scale - this.dragOffsetX);
    this.draggingNode.y = Math.round((event.clientY - this.dragCanvasTop - this.panY) / this.scale - this.dragOffsetY);
  }

  pointerUp(event?: PointerEvent): void {
    if (this.wireDrag) {
      if (event) this.endBranchDrag(event);
      else this.cancelWire();
      return;
    }
    this.draggingNode = undefined;
  }

  startBranchDrag(event: PointerEvent, node: WorkflowNode, branch: WorkflowBranch): void {
    event.preventDefault();
    event.stopPropagation();
    const point = this.toWorldPoint(event);
    this.wireFrom = { node, branch };
    this.wireDrag = { node, branch, x: point.x, y: point.y, pointerId: event.pointerId };
    this.selectedNode = node;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  updateWireDrag(event: PointerEvent): void {
    if (!this.wireDrag) return;
    event.preventDefault();
    event.stopPropagation();
    const point = this.toWorldPoint(event);
    this.wireDrag.x = point.x;
    this.wireDrag.y = point.y;
  }

  endBranchDrag(event: PointerEvent): void {
    if (!this.wireDrag) return;
    event.preventDefault();
    event.stopPropagation();
    this.updateWireDrag(event);
    const target = this.nodeFromPointer(event.clientX, event.clientY);
    const source = this.wireDrag.node;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    if (target && target.clientNodeId !== source.clientNodeId) {
      this.completeBranchWire(target);
    } else {
      this.wireFrom = undefined;
      this.flash('Drop the connector on another node to link it.');
    }
    this.wireDrag = undefined;
  }

  wirePreviewPath(): string {
    if (!this.wireDrag) return '';
    const source = this.branchSourcePoint(this.wireDrag.node, this.wireDrag.branch);
    const tx = this.wireDrag.x;
    const ty = this.wireDrag.y;
    const mx = source.x + Math.max(80, (tx - source.x) / 2);
    return `M ${source.x} ${source.y} C ${mx} ${source.y}, ${mx} ${ty}, ${tx} ${ty}`;
  }

  linkTarget(event: MouseEvent, node: WorkflowNode): void {
    event.stopPropagation();
    if (!this.wireFrom || this.wireFrom.node.clientNodeId === node.clientNodeId) return;
    this.completeBranchWire(node);
  }

  zoom(delta: number): void {
    this.scale = Math.min(1.6, Math.max(0.55, Number((this.scale + delta).toFixed(2))));
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement)?.closest('.node-card, button, input, textarea, select')) return;
    this.isPanningCanvas = true;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panOriginX = this.panX;
    this.panOriginY = this.panY;
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.isPanningCanvas) return;
    this.panX = this.panOriginX + event.clientX - this.panStartX;
    this.panY = this.panOriginY + event.clientY - this.panStartY;
  }

  onCanvasMouseUp(): void {
    this.isPanningCanvas = false;
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = (pointerX - this.panX) / this.scale;
    const worldY = (pointerY - this.panY) / this.scale;
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    const nextScale = Math.min(2.5, Math.max(0.35, Number((this.scale * factor).toFixed(3))));
    if (nextScale === this.scale) return;
    this.scale = nextScale;
    this.panX = pointerX - worldX * nextScale;
    this.panY = pointerY - worldY * nextScale;
  }

  getCanvasTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }

  getCanvasBackgroundSize(): string {
    const grid = 32 * this.scale;
    return `${grid}px ${grid}px`;
  }

  getCanvasBackgroundPosition(): string {
    return `${this.panX}px ${this.panY}px`;
  }

  getWorldWidth(): number {
    const maxRight = this.workflow.nodes.length
      ? Math.max(...this.workflow.nodes.map(node => node.x + 420))
      : 1200;
    return Math.max(2200, maxRight + 800);
  }

  getWorldHeight(): number {
    const maxBottom = this.workflow.nodes.length
      ? Math.max(...this.workflow.nodes.map(node => node.y + 260))
      : 900;
    return Math.max(1600, maxBottom + 600);
  }

  outgoingConnections(node: WorkflowNode): WorkflowConnection[] {
    return this.workflow.connections.filter(edge => edge.sourceNodeId === node.clientNodeId);
  }

  connectionPath(edge: WorkflowConnection): string {
    const source = this.workflow.nodes.find(node => node.clientNodeId === edge.sourceNodeId);
    const target = this.workflow.nodes.find(node => node.clientNodeId === edge.targetNodeId);
    if (!source || !target) return '';
    const sx = source.x + 296;
    const sy = source.y + this.branchWireOffset(source, edge);
    const tx = target.x;
    const ty = target.y + 42;
    const mx = sx + Math.max(80, (tx - sx) / 2);
    return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
  }

  branchSourcePoint(node: WorkflowNode, branch: WorkflowBranch): { x: number; y: number } {
    return {
      x: node.x + 296,
      y: node.y + this.branchOffsetForKey(node, branch.key)
    };
  }

  nodeHasQueue(node: WorkflowNode): boolean {
    return node.type === 'QUEUE_ROUTING' || node.type === 'ESCALATE_TO_AGENT';
  }

  nodeTypeLabel(type: string): string {
    return this.nodeTypes.find(item => item.type === type)?.label || type.replaceAll('_', ' ');
  }

  getNodeBranches(node: WorkflowNode): WorkflowBranch[] {
    const props = node.properties || {};
    if (node.type === 'END') return [];
    if (node.type === 'CHOICE_RESPONSE' || node.type === 'CHOICE' || node.type === 'QUESTION') {
      const choices = this.getChoiceOptions(node);
      return choices.map(choice => ({
        key: this.choiceKey(choice),
        label: choice,
        kind: 'choice'
      }));
    }
    if (node.type === 'TEXT_ENTRY') {
      return [{ key: 'text', label: props['textPathLabel'] || 'Any text', kind: 'text' }];
    }
    if (node.type === 'BOOLEAN_RESPONSE') {
      return [
        { key: 'yes', label: props['yesLabel'] || 'Yes', kind: 'boolean' },
        { key: 'no', label: props['noLabel'] || 'No', kind: 'boolean' }
      ];
    }
    return [{ key: 'next', label: 'Next', kind: 'next' }];
  }

  getChoiceOptions(node: WorkflowNode): string[] {
    const raw = node.properties?.['choices'];
    const choices = Array.isArray(raw) ? raw.map(value => String(value).trim()).filter(Boolean) : [];
    return choices.length ? choices : ['Option 1', 'Option 2'];
  }

  addChoiceOption(node: WorkflowNode): void {
    node.properties ||= {};
    const choices = this.getChoiceOptions(node);
    node.properties['choices'] = [...choices, `Option ${choices.length + 1}`];
  }

  updateChoiceOption(node: WorkflowNode, index: number, value: string): void {
    node.properties ||= {};
    const choices = this.getChoiceOptions(node);
    const old = choices[index];
    choices[index] = value;
    node.properties['choices'] = choices;
    const oldKey = this.choiceKey(old);
    const newKey = this.choiceKey(value);
    this.workflow.connections = this.workflow.connections.map(edge => {
      if (edge.sourceNodeId === node.clientNodeId && this.edgeBranchKey(edge) === oldKey) {
        return { ...edge, sourceHandle: newKey, label: value };
      }
      return edge;
    });
  }

  removeChoiceOption(node: WorkflowNode, index: number): void {
    node.properties ||= {};
    const choices = this.getChoiceOptions(node);
    const [removed] = choices.splice(index, 1);
    node.properties['choices'] = choices;
    const removedKey = this.choiceKey(removed);
    this.workflow.connections = this.workflow.connections.filter(edge =>
      !(edge.sourceNodeId === node.clientNodeId && this.edgeBranchKey(edge) === removedKey)
    );
  }

  branchConnection(node: WorkflowNode, branch: WorkflowBranch): WorkflowConnection | undefined {
    return this.workflow.connections.find(edge => edge.sourceNodeId === node.clientNodeId && this.edgeBranchKey(edge) === branch.key);
  }

  branchTargetLabel(node: WorkflowNode, branch: WorkflowBranch): string {
    const edge = this.branchConnection(node, branch);
    if (!edge) return 'Unlinked';
    const target = this.workflow.nodes.find(item => item.clientNodeId === edge.targetNodeId);
    return target?.title || edge.targetNodeId;
  }

  isBranchWiring(node: WorkflowNode, branch: WorkflowBranch): boolean {
    return this.wireFrom?.node.clientNodeId === node.clientNodeId && this.wireFrom.branch.key === branch.key;
  }

  copy(value: string): void {
    void navigator.clipboard?.writeText(value);
    this.flash('Copied.');
  }

  publicChatUrl(project: ChatProject = this.selected!): string {
    if (!project) return '';
    const raw = (project.publicUrl || `/chat/${project.slug}`).trim();
    if (/^https?:\/\//i.test(raw)) return raw;
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return `${this.currentOrigin()}${path}`;
  }

  openPublicChat(): void {
    const url = this.publicChatUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  embedSnippet(): string {
    return `<iframe src="${this.publicChatUrl()}" width="420" height="620"></iframe>`;
  }

  private normalizeWorkflow(raw: any): ChatWorkflow {
    return {
      id: raw?.id,
      projectId: raw?.projectId,
      status: raw?.status || 'DRAFT',
      version: raw?.version || 1,
      nodes: (raw?.nodes || []).map((node: any) => ({
        ...node,
        type: this.normalizeNodeType(node.type),
        properties: this.normalizeNodeProperties(this.normalizeNodeType(node.type), node.properties || {})
      })),
      connections: (raw?.connections || []).map((edge: WorkflowConnection) => ({
        ...edge,
        sourceHandle: edge.sourceHandle || this.choiceKey(edge.label || 'next')
      }))
    };
  }

  private seedWorkflow(): void {
    this.workflow.nodes = [
      { clientNodeId: 'start', type: 'START', title: 'Start', x: 160, y: 280, properties: { message: this.selected?.welcomeMessage || 'Hi. How can we help?' } },
      { clientNodeId: 'ask-issue', type: 'CHOICE_RESPONSE', title: 'Identify need', x: 460, y: 260, properties: { message: 'What can we help you with today?', choices: ['Sales', 'Support', 'Billing'] } },
      { clientNodeId: 'route-support', type: 'ESCALATE_TO_AGENT', title: 'Escalate', x: 820, y: 260, properties: { queueId: this.queues[0]?.id } }
    ];
    this.workflow.connections = [
      { sourceNodeId: 'start', targetNodeId: 'ask-issue', label: 'Next', sourceHandle: 'next' },
      { sourceNodeId: 'ask-issue', targetNodeId: 'route-support', label: 'Support', sourceHandle: 'choice:support' }
    ];
  }

  private defaultPropertiesFor(type: string): Record<string, any> {
    if (type === 'START') return { message: this.selected?.welcomeMessage || 'Hi. How can we help?' };
    if (type === 'MESSAGE') return { message: 'Write the bot message here.' };
    if (type === 'CHOICE_RESPONSE') return { message: 'Choose one option:', choices: ['Option 1', 'Option 2'] };
    if (type === 'TEXT_ENTRY') return { message: 'Please write your answer.', variableName: 'customer_input', textPathLabel: 'Any text' };
    if (type === 'BOOLEAN_RESPONSE') return { message: 'Is this correct?', yesLabel: 'Yes', noLabel: 'No' };
    if (type === 'END') return { message: 'Thanks. This conversation is now closed.' };
    return {};
  }

  private normalizeNodeType(type: string): string {
    if (type === 'QUESTION' || type === 'CHOICE') return 'CHOICE_RESPONSE';
    return type || 'MESSAGE';
  }

  private normalizeNodeProperties(type: string, props: Record<string, any>): Record<string, any> {
    const defaults = this.defaultPropertiesFor(type);
    const normalized = { ...defaults, ...props };
    if (props['question'] && !props['message']) normalized['message'] = props['question'];
    if (type === 'CHOICE_RESPONSE' && !Array.isArray(normalized['choices'])) {
      normalized['choices'] = defaults['choices'];
    }
    return normalized;
  }

  private choiceKey(label: string): string {
    const normalized = (label || 'choice')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `choice:${normalized || 'choice'}`;
  }

  private edgeBranchKey(edge: WorkflowConnection): string {
    if (edge.sourceHandle) return edge.sourceHandle;
    if (edge.label) return this.choiceKey(edge.label);
    return 'next';
  }

  private currentOrigin(): string {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }

  private branchWireOffset(node: WorkflowNode, edge: WorkflowConnection): number {
    return this.branchOffsetForKey(node, this.edgeBranchKey(edge));
  }

  private branchOffsetForKey(node: WorkflowNode, key: string): number {
    const branches = this.getNodeBranches(node);
    const index = Math.max(0, branches.findIndex(branch => branch.key === key));
    return 114 + index * 39;
  }

  private toWorldPoint(event: PointerEvent): { x: number; y: number } {
    const rect = (event.currentTarget as HTMLElement).closest('.tree-canvas')?.getBoundingClientRect()
      || document.querySelector('.chat-projects-shell .workflow .tree-canvas')?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return {
      x: (event.clientX - left - this.panX) / this.scale,
      y: (event.clientY - top - this.panY) / this.scale
    };
  }

  private nodeFromPointer(clientX: number, clientY: number): WorkflowNode | undefined {
    if (typeof document === 'undefined') return undefined;
    const element = document.elementFromPoint(clientX, clientY);
    const nodeCard = element?.closest('.chat-projects-shell .workflow .node-card') as HTMLElement | null;
    const id = nodeCard?.dataset['nodeId'];
    if (!id) return undefined;
    return this.workflow.nodes.find(node => node.clientNodeId === id);
  }

  private flash(text: string): void {
    this.message = text;
    window.setTimeout(() => {
      if (this.message === text) this.message = '';
    }, 4500);
  }
}
