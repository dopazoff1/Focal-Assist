import { CommonModule } from '@angular/common';
import { ApplicationRef, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { StaffService, StaffUser } from '../../services/staff';
import { TeamLinksService } from '../../services/team-links';

type TeamNodeRole = 'AGENT' | 'TEAM_LEADER' | 'QA';
type WireKind = 'TL' | 'QA';

interface TeamNode {
  id: number;
  role: TeamNodeRole;
  label: string;
  email: string;
  x: number;
  y: number;
}

interface AgentAssignment {
  teamLeaderId: number | null;
  qaId: number | null;
}

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team-management.html',
  styleUrls: ['./team-management.css']
})
export class TeamManagementComponent implements OnInit {
  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLDivElement>;
  @ViewChildren('wireBtn') wireButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  loading = false;
  saving = false;
  statusMessage = '';

  teamLeaders: StaffUser[] = [];
  qas: StaffUser[] = [];
  agents: StaffUser[] = [];

  nodes: TeamNode[] = [];
  selectedNodeId: number | null = null;

  assignments = new Map<number, AgentAssignment>();

  draggingNodeId: number | null = null;
  dragOffsetX = 0;
  dragOffsetY = 0;

  isPanningCanvas = false;
  canvasPanX = 0;
  canvasPanY = 0;
  canvasZoom = 1;
  private panStartX = 0;
  private panStartY = 0;

  wireFrom: { agentId: number; kind: WireKind } | null = null;
  wireMouseX = 0;
  wireMouseY = 0;

  constructor(
    private staffService: StaffService,
    private teamLinksService: TeamLinksService,
    private cdr: ChangeDetectorRef,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  get selectedNode(): TeamNode | undefined {
    return this.nodes.find(n => n.id === this.selectedNodeId);
  }

  get tlNodes(): TeamNode[] {
    return this.nodes.filter(n => n.role === 'TEAM_LEADER');
  }

  get qaNodes(): TeamNode[] {
    return this.nodes.filter(n => n.role === 'QA');
  }

  async load(): Promise<void> {
    this.loading = true;
    this.statusMessage = 'Loading team map...';
    try {
      const users = await firstValueFrom(this.staffService.listUsers());
      const active = users.filter(u => u.active);
      this.teamLeaders = active.filter(u => this.normalizeRole(u.role) === 'TEAM_LEADER');
      this.qas = active.filter(u => this.normalizeRole(u.role) === 'QA');
      this.agents = active.filter(u => this.normalizeRole(u.role) === 'AGENT');

      this.buildNodes();

      const links = await firstValueFrom(this.teamLinksService.getAll());
      this.assignments.clear();
      for (const a of this.agents) {
        this.assignments.set(a.id, { teamLeaderId: null, qaId: null });
      }
      for (const link of links) {
        if (!this.assignments.has(link.agentId)) continue;
        const current = this.assignments.get(link.agentId)!;
        const role = this.normalizeManagerRole((link as any).managerRole);
        if (role === 'TEAM_LEADER') current.teamLeaderId = Number((link as any).managerId);
        if (role === 'QA') current.qaId = Number((link as any).managerId);
      }

      this.autoLayout();
      this.selectedNodeId = this.nodes[0]?.id ?? null;
      this.statusMessage = `Loaded ${this.agents.length} agents, ${this.teamLeaders.length} TLs, ${this.qas.length} QAs.`;
      this.requestMapRefresh();
    } catch (e: unknown) {
      this.statusMessage = (e as Error)?.message || 'Failed to load team map.';
      this.requestMapRefresh();
    } finally {
      this.loading = false;
      this.requestMapRefresh();
    }
  }

  private buildNodes(): void {
    const nodes: TeamNode[] = [];

    this.agents.forEach((a, idx) => nodes.push({
      id: a.id,
      role: 'AGENT',
      label: `${a.firstName} ${a.lastName}`,
      email: a.email,
      x: 100,
      y: 80 + idx * 150
    }));

    this.teamLeaders.forEach((tl, idx) => nodes.push({
      id: tl.id,
      role: 'TEAM_LEADER',
      label: `${tl.firstName} ${tl.lastName}`,
      email: tl.email,
      x: 640,
      y: 80 + idx * 170
    }));

    this.qas.forEach((qa, idx) => nodes.push({
      id: qa.id,
      role: 'QA',
      label: `${qa.firstName} ${qa.lastName}`,
      email: qa.email,
      x: 980,
      y: 80 + idx * 170
    }));

    this.nodes = nodes;
  }

  autoLayout(): void {
    const verticalGap = 170;
    const agentX = 90;
    const tlX = 640;
    const qaX = 980;

    this.nodes
      .filter(n => n.role === 'AGENT')
      .sort((a, b) => a.id - b.id)
      .forEach((n, i) => {
        n.x = agentX;
        n.y = 80 + i * verticalGap;
      });

    this.nodes
      .filter(n => n.role === 'TEAM_LEADER')
      .sort((a, b) => a.id - b.id)
      .forEach((n, i) => {
        n.x = tlX;
        n.y = 80 + i * verticalGap;
      });

    this.nodes
      .filter(n => n.role === 'QA')
      .sort((a, b) => a.id - b.id)
      .forEach((n, i) => {
        n.x = qaX;
        n.y = 80 + i * verticalGap;
      });
    this.requestMapRefresh();
  }

  selectNode(nodeId: number): void {
    this.selectedNodeId = nodeId;
    this.requestMapRefresh();
  }

  startDrag(event: MouseEvent, node: TeamNode): void {
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
    if (this.wireFrom || this.draggingNodeId) return;
    if (event.button !== 0 && event.button !== 1) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.node-card') || target.closest('.choice-wire')) return;

    this.isPanningCanvas = true;
    this.panStartX = event.clientX - this.canvasPanX;
    this.panStartY = event.clientY - this.canvasPanY;
    event.preventDefault();
    this.requestMapRefresh();
  }

  onCanvasWheel(event: WheelEvent): void {
    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (!rect) return;

    event.preventDefault();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = (pointerX - this.canvasPanX) / this.canvasZoom;
    const worldY = (pointerY - this.canvasPanY) / this.canvasZoom;

    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(2.5, Math.max(0.35, this.canvasZoom * zoomFactor));
    if (newZoom === this.canvasZoom) return;

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
    if (this.wireFrom) {
      this.requestMapRefresh();
    }

    if (!this.draggingNodeId) return;
    const node = this.getNodeById(this.draggingNodeId);
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
    if (this.wireFrom) this.cancelWire();
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.stopDrag();
    this.stopPan();
    if (this.wireFrom) this.cancelWire();
  }

  startWire(event: MouseEvent, agentId: number, kind: WireKind): void {
    event.preventDefault();
    event.stopPropagation();
    const { x, y } = this.getCanvasPoint(event);
    this.wireFrom = { agentId, kind };
    this.wireMouseX = x;
    this.wireMouseY = y;
    this.statusMessage = `Link ${kind} for agent #${agentId}: drop on a ${kind === 'TL' ? 'Team Leader' : 'QA'} node.`;
    this.requestMapRefresh();
  }

  completeWire(event: MouseEvent, targetNode: TeamNode): void {
    if (!this.wireFrom) return;
    event.preventDefault();
    event.stopPropagation();

    const expectedRole: TeamNodeRole = this.wireFrom.kind === 'TL' ? 'TEAM_LEADER' : 'QA';
    if (targetNode.role !== expectedRole) {
      this.cancelWire(`Invalid target. Choose a ${expectedRole} node.`);
      return;
    }

    const assignment = this.assignments.get(this.wireFrom.agentId) ?? { teamLeaderId: null, qaId: null };
    if (this.wireFrom.kind === 'TL') {
      assignment.teamLeaderId = targetNode.id;
    } else {
      assignment.qaId = targetNode.id;
    }
    this.assignments.set(this.wireFrom.agentId, assignment);

    this.selectedNodeId = this.wireFrom.agentId;
    this.cancelWire('Link updated.');
    this.requestMapRefresh();
  }

  cancelWire(message = 'Wiring canceled.'): void {
    this.wireFrom = null;
    this.statusMessage = message;
    this.requestMapRefresh();
  }

  clearLink(agentId: number, kind: WireKind): void {
    const assignment = this.assignments.get(agentId) ?? { teamLeaderId: null, qaId: null };
    if (kind === 'TL') {
      assignment.teamLeaderId = null;
    } else {
      assignment.qaId = null;
    }
    this.assignments.set(agentId, assignment);
    this.statusMessage = `${kind} link cleared for agent #${agentId}.`;
    this.requestMapRefresh();
  }

  async saveToDatabase(): Promise<void> {
    this.saving = true;
    this.statusMessage = 'Saving team links...';

    try {
      const ops = this.agents.map(agent => {
        const a = this.assignments.get(agent.id) ?? { teamLeaderId: null, qaId: null };
        return firstValueFrom(this.teamLinksService.saveForAgent(agent.id, a.teamLeaderId, a.qaId));
      });
      await Promise.all(ops);
      this.statusMessage = 'Team links saved.';
      this.requestMapRefresh();
    } catch (e: unknown) {
      this.statusMessage = `Save failed: ${(e as Error)?.message || 'unknown error'}`;
      this.requestMapRefresh();
    } finally {
      this.saving = false;
      this.requestMapRefresh();
    }
  }

  getNodeById(id: number): TeamNode | undefined {
    return this.nodes.find(n => n.id === id);
  }

  getAgentAssignment(agentId: number): AgentAssignment {
    return this.assignments.get(agentId) ?? { teamLeaderId: null, qaId: null };
  }

  getManagerLabel(id: number | null, role: TeamNodeRole): string {
    if (!id) return 'Unlinked';
    const node = this.nodes.find(n => n.id === id && n.role === role);
    return node ? node.label : `#${id}`;
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

  getConnectionPath(agentId: number, kind: WireKind): string {
    const agent = this.getNodeById(agentId);
    if (!agent || agent.role !== 'AGENT') return '';

    const assignment = this.getAgentAssignment(agentId);
    const targetId = kind === 'TL' ? assignment.teamLeaderId : assignment.qaId;
    if (!targetId) return '';

    const expectedRole: TeamNodeRole = kind === 'TL' ? 'TEAM_LEADER' : 'QA';
    const target = this.nodes.find(n => n.id === targetId && n.role === expectedRole);
    if (!target) return '';

    const start = this.getAgentAnchor(agent, kind);
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
    if (!this.wireFrom) return '';
    const agent = this.getNodeById(this.wireFrom.agentId);
    if (!agent) return '';

    const anchor = this.getAgentAnchor(agent, this.wireFrom.kind);
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

  private getAgentAnchor(agent: TeamNode, kind: WireKind): { x: number; y: number } {
    const indexOffset = kind === 'TL' ? 0 : 1;
    return {
      x: agent.x + 296,
      y: agent.y + 114 + indexOffset * 30
    };
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

  private normalizeRole(raw: string): string {
    const role = (raw || '').toUpperCase().replace('ROLE_', '');
    if (role === '2') return 'AGENT';
    if (role === '1') return 'ADMIN';
    if (role === 'HEAD_OF_CS') return 'HEAD_CS';
    if (role === 'OPS') return 'HEAD_CS';
    return role;
  }

  private normalizeManagerRole(raw: unknown): TeamNodeRole | null {
    const role = String(raw ?? '').toUpperCase().replace('ROLE_', '');
    if (role === 'TEAM_LEADER') return 'TEAM_LEADER';
    if (role === 'QA') return 'QA';
    return null;
  }

  private requestMapRefresh(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.appRef.tick();
  }
}
