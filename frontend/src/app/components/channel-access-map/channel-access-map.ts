import { CommonModule } from '@angular/common';
import { ApplicationRef, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CollaborationChannel,
  CollaborationCurrentUser,
  CollaborationService,
  CollaborationUser
} from '../../services/collaboration';
import { AuthService } from '../../services/auth';

interface AccessNode {
  id: number;
  kind: 'USER' | 'CHANNEL';
  label: string;
  meta: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-channel-access-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './channel-access-map.html',
  styleUrls: ['./channel-access-map.css']
})
export class ChannelAccessMapComponent implements OnInit {
  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLDivElement>;

  loading = false;
  saving = false;
  statusMessage = '';
  errorMessage = '';

  users: CollaborationUser[] = [];
  channels: CollaborationChannel[] = [];
  nodes: AccessNode[] = [];
  assignments = new Map<number, number[]>();

  selectedNodeId: number | null = null;

  draggingNodeId: number | null = null;
  dragOffsetX = 0;
  dragOffsetY = 0;

  isPanningCanvas = false;
  canvasPanX = 0;
  canvasPanY = 0;
  canvasZoom = 1;
  private panStartX = 0;
  private panStartY = 0;

  wireFromUserId: number | null = null;
  wireMouseX = 0;
  wireMouseY = 0;

  constructor(
    private auth: AuthService,
    private collaboration: CollaborationService,
    private cdr: ChangeDetectorRef,
    private appRef: ApplicationRef
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  get currentUserContext(): CollaborationCurrentUser {
    const parsedId = Number(this.auth.getUser()?.id || localStorage.getItem('id') || 0);
    return {
      id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0,
      fullName: this.auth.getUserName() || 'Current User',
      email: (this.auth.getUser()?.email || localStorage.getItem('email') || '').toString(),
      role: this.auth.getNormalizedRole() || 'AGENT',
      status: this.auth.getUserStatus() || 'ONLINE'
    };
  }

  get selectedNode(): AccessNode | undefined {
    return this.nodes.find(node => node.id === this.selectedNodeId);
  }

  get userNodes(): AccessNode[] {
    return this.nodes.filter(node => node.kind === 'USER');
  }

  get channelNodes(): AccessNode[] {
    return this.nodes.filter(node => node.kind === 'CHANNEL');
  }

  get selectedUserNode(): AccessNode | null {
    const node = this.selectedNode;
    return node?.kind === 'USER' ? node : null;
  }

  get selectedChannelNode(): AccessNode | null {
    const node = this.selectedNode;
    return node?.kind === 'CHANNEL' ? node : null;
  }

  async load(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.statusMessage = 'Loading channel access map...';

    try {
      const map = await this.collaboration.getChannelAccessMap(this.currentUserContext);
      this.users = map.users
        .filter(user => user.active)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      this.channels = map.channels
        .filter(channel => !channel.archived)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      this.assignments.clear();
      for (const user of this.users) {
        const raw = map.channelIdsByUserId[String(user.id)] || [];
        const normalized = this.uniquePositiveNumbers(raw).filter(channelId => this.hasChannel(channelId));
        this.assignments.set(user.id, normalized);
      }

      this.buildNodes();
      this.autoLayout();
      this.selectedNodeId = this.nodes[0]?.id || null;
      this.statusMessage = `Loaded ${this.users.length} users and ${this.channels.length} channels.`;
      this.requestMapRefresh();
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to load channel access map.';
      this.statusMessage = this.errorMessage;
      this.requestMapRefresh();
    } finally {
      this.loading = false;
      this.requestMapRefresh();
    }
  }

  private buildNodes(): void {
    const userNodes: AccessNode[] = this.users.map((user, index) => ({
      id: user.id,
      kind: 'USER',
      label: user.name || user.email || `User #${user.id}`,
      meta: `${user.role} · ${user.email}`,
      x: 90,
      y: 80 + index * 150
    }));

    const channelNodes: AccessNode[] = this.channels.map((channel, index) => ({
      id: Number(channel.id),
      kind: 'CHANNEL',
      label: `#${channel.name || `channel-${channel.id}`}`,
      meta: channel.topic || channel.description || (channel.isPrivate ? 'Private channel' : 'Public channel'),
      x: 700,
      y: 80 + index * 150
    }));

    this.nodes = [...userNodes, ...channelNodes];
  }

  autoLayout(): void {
    const verticalGap = 155;
    const userX = 90;
    const channelX = 700;

    this.userNodes
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
      .forEach((node, index) => {
        node.x = userX;
        node.y = 80 + index * verticalGap;
      });

    this.channelNodes
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
      .forEach((node, index) => {
        node.x = channelX;
        node.y = 80 + index * verticalGap;
      });

    this.requestMapRefresh();
  }

  selectNode(nodeId: number): void {
    this.selectedNodeId = nodeId;
    this.requestMapRefresh();
  }

  startDrag(event: MouseEvent, node: AccessNode): void {
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
    if (this.wireFromUserId || this.draggingNodeId) return;
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
    const newZoom = Math.min(2.6, Math.max(0.35, this.canvasZoom * zoomFactor));
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

    if (this.wireFromUserId) {
      this.requestMapRefresh();
    }

    if (!this.draggingNodeId) return;
    const node = this.getNodeById(this.draggingNodeId);
    if (!node) return;
    node.x = Math.max(8, x - this.dragOffsetX);
    node.y = Math.max(8, y - this.dragOffsetY);
    this.requestMapRefresh();
  }

  onCanvasMouseUp(): void {
    this.stopDrag();
    this.stopPan();
    if (this.wireFromUserId) {
      this.cancelWire();
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.stopDrag();
    this.stopPan();
    if (this.wireFromUserId) {
      this.cancelWire();
    }
  }

  startWire(event: MouseEvent, userId: number): void {
    event.preventDefault();
    event.stopPropagation();
    const { x, y } = this.getCanvasPoint(event);
    this.wireFromUserId = userId;
    this.wireMouseX = x;
    this.wireMouseY = y;
    this.statusMessage = `Link channel access for user #${userId}: drop on a channel node.`;
    this.requestMapRefresh();
  }

  completeWire(event: MouseEvent, targetNode: AccessNode): void {
    if (!this.wireFromUserId) return;
    event.preventDefault();
    event.stopPropagation();

    if (targetNode.kind !== 'CHANNEL') {
      this.cancelWire('Invalid target. Drop on a channel node.');
      return;
    }

    this.linkUserToChannel(this.wireFromUserId, targetNode.id);
    this.selectedNodeId = this.wireFromUserId;
    this.cancelWire('Channel link updated.');
    this.requestMapRefresh();
  }

  cancelWire(message = 'Wiring canceled.'): void {
    this.wireFromUserId = null;
    this.statusMessage = message;
    this.requestMapRefresh();
  }

  toggleSelectedUserChannel(channelId: number): void {
    const selectedUser = this.selectedUserNode;
    if (!selectedUser) return;
    if (this.isChannelLinked(selectedUser.id, channelId)) {
      this.unlinkUserFromChannel(selectedUser.id, channelId);
    } else {
      this.linkUserToChannel(selectedUser.id, channelId);
    }
    this.requestMapRefresh();
  }

  clearAllForUser(userId: number): void {
    this.assignments.set(userId, []);
    this.statusMessage = `Cleared channel links for user #${userId}.`;
    this.requestMapRefresh();
  }

  async saveToDatabase(): Promise<void> {
    this.saving = true;
    this.errorMessage = '';
    this.statusMessage = 'Saving channel access links...';
    this.requestMapRefresh();

    try {
      for (const user of this.users) {
        const channelIds = this.getUserChannelIds(user.id);
        await this.collaboration.replaceUserChannelAccess(this.currentUserContext, user.id, channelIds);
      }
      await this.load();
      this.statusMessage = 'Channel access map saved to DB.';
    } catch (error: unknown) {
      this.errorMessage = (error as Error)?.message || 'Failed to save channel access map.';
      this.statusMessage = this.errorMessage;
    } finally {
      this.saving = false;
      this.requestMapRefresh();
    }
  }

  getUserChannelIds(userId: number): number[] {
    return [...(this.assignments.get(userId) || [])].sort((a, b) => a - b);
  }

  getChannelName(channelId: number): string {
    const channel = this.channels.find(item => Number(item.id) === Number(channelId));
    return channel?.name ? `#${channel.name}` : `#${channelId}`;
  }

  getChannelMemberCount(channelId: number): number {
    const channel = this.channels.find(item => Number(item.id) === Number(channelId));
    return Array.isArray(channel?.memberIds) ? channel.memberIds.length : 0;
  }

  isChannelLinked(userId: number, channelId: number): boolean {
    return this.getUserChannelIds(userId).includes(Number(channelId));
  }

  getConnectionPath(userId: number, channelId: number): string {
    const userNode = this.userNodes.find(node => node.id === userId);
    const channelNode = this.channelNodes.find(node => node.id === channelId);
    if (!userNode || !channelNode) return '';

    const startX = userNode.x + 296;
    const startY = userNode.y + 64;
    const endX = channelNode.x;
    const endY = channelNode.y + 64;
    const controlOffset = Math.max(90, Math.abs(endX - startX) * 0.35);
    const c1x = startX + controlOffset;
    const c1y = startY;
    const c2x = endX - controlOffset;
    const c2y = endY;
    return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
  }

  getLiveWirePath(): string {
    if (!this.wireFromUserId) return '';
    const userNode = this.userNodes.find(node => node.id === this.wireFromUserId);
    if (!userNode) return '';

    const startX = userNode.x + 296;
    const startY = userNode.y + 64;
    const endX = this.wireMouseX;
    const endY = this.wireMouseY;
    const controlOffset = Math.max(80, Math.abs(endX - startX) * 0.35);
    const c1x = startX + controlOffset;
    const c1y = startY;
    const c2x = endX - controlOffset;
    const c2y = endY;
    return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
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

  trackNode(_: number, node: AccessNode): string {
    return `${node.kind}-${node.id}`;
  }

  trackNumber(_: number, value: number): number {
    return value;
  }

  private linkUserToChannel(userId: number, channelId: number): void {
    const normalizedUserId = Number(userId);
    const normalizedChannelId = Number(channelId);
    if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return;
    if (!Number.isFinite(normalizedChannelId) || normalizedChannelId <= 0) return;
    if (!this.hasChannel(normalizedChannelId)) return;

    const current = this.getUserChannelIds(normalizedUserId);
    if (current.includes(normalizedChannelId)) return;
    this.assignments.set(normalizedUserId, [...current, normalizedChannelId].sort((a, b) => a - b));
  }

  private unlinkUserFromChannel(userId: number, channelId: number): void {
    const normalizedUserId = Number(userId);
    const normalizedChannelId = Number(channelId);
    if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return;
    if (!Number.isFinite(normalizedChannelId) || normalizedChannelId <= 0) return;
    const next = this.getUserChannelIds(normalizedUserId).filter(id => id !== normalizedChannelId);
    this.assignments.set(normalizedUserId, next);
  }

  private stopDrag(): void {
    this.draggingNodeId = null;
    this.requestMapRefresh();
  }

  private stopPan(): void {
    this.isPanningCanvas = false;
    this.requestMapRefresh();
  }

  private getNodeById(id: number): AccessNode | undefined {
    return this.nodes.find(node => node.id === id);
  }

  private hasChannel(channelId: number): boolean {
    return this.channels.some(channel => Number(channel.id) === Number(channelId));
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

  private uniquePositiveNumbers(values: number[]): number[] {
    return [...new Set(
      (Array.isArray(values) ? values : [])
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value > 0)
    )];
  }

  private requestMapRefresh(): void {
    try {
      this.cdr?.markForCheck?.();
      this.cdr?.detectChanges?.();
    } catch {
      // no-op
    }
    try {
      this.appRef?.tick?.();
    } catch {
      // no-op
    }
  }
}
