import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  AccessControlService,
  AccessFeatureDefinition,
  AccessRoleLink,
  AccessRoleProfile
} from '../../services/access-control';

interface AccessMapNode {
  id: string;
  kind: 'ROLE' | 'FEATURE';
  roleName?: string;
  featureKey?: string;
  label: string;
  meta: string;
  x: number;
  y: number;
  system?: boolean;
}

@Component({
  selector: 'app-role-access-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './role-access-map.html',
  styleUrls: ['./role-access-map.css']
})
export class RoleAccessMapComponent implements OnInit {
  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLDivElement>;

  loading = false;
  saving = false;
  statusMessage = '';
  errorMessage = '';

  roles: AccessRoleProfile[] = [];
  features: AccessFeatureDefinition[] = [];
  links: AccessRoleLink[] = [];
  visibleLinks: AccessRoleLink[] = [];
  invalidLinks: AccessRoleLink[] = [];
  nodes: AccessMapNode[] = [];
  selectedNodeId: string | null = null;
  private nextSelectionId: string | null = null;

  worldWidth = 2200;
  worldHeight = 1600;

  newRoleName = '';
  newRoleDescription = '';

  draggingNodeId: string | null = null;
  dragOffsetX = 0;
  dragOffsetY = 0;

  isPanningCanvas = false;
  canvasPanX = 0;
  canvasPanY = 0;
  canvasZoom = 1;
  private panStartX = 0;
  private panStartY = 0;

  wireFromRole: string | null = null;
  wireMouseX = 0;
  wireMouseY = 0;

  constructor(private accessControl: AccessControlService) {}

  ngOnInit(): void {
    this.load(true);
  }

  get roleNodes(): AccessMapNode[] {
    return this.nodes.filter(node => node.kind === 'ROLE');
  }

  get featureNodes(): AccessMapNode[] {
    return this.nodes.filter(node => node.kind === 'FEATURE');
  }

  get selectedNode(): AccessMapNode | undefined {
    return this.nodes.find(node => node.id === this.selectedNodeId);
  }

  get selectedRoleNode(): AccessMapNode | null {
    const node = this.selectedNode;
    return node?.kind === 'ROLE' ? node : null;
  }

  get selectedFeatureNode(): AccessMapNode | null {
    const node = this.selectedNode;
    return node?.kind === 'FEATURE' ? node : null;
  }

  load(force = true): void {
    this.loading = true;
    this.errorMessage = '';
    this.statusMessage = 'Loading role access map...';
    const preferredSelection = this.nextSelectionId || this.selectedNodeId;
    this.nextSelectionId = null;
    this.accessControl.ensureLoaded(force)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (config) => {
          this.roles = [...config.roles].sort((a, b) => {
            if (a.system !== b.system) return a.system ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          });
          this.features = this.accessControl.getFeatures();
          this.links = this.uniqueLinks(config.links || []);
          this.buildNodes();
          this.refreshLinkState();
          this.updateWorldSize();
          if (preferredSelection && this.nodes.some(node => node.id === preferredSelection)) {
            this.selectedNodeId = preferredSelection;
          } else {
            this.selectedNodeId = this.nodes[0]?.id || null;
          }
          this.statusMessage = this.invalidLinks.length
            ? `Loaded ${this.roles.length} account types, ${this.features.length} features. Ignored ${this.invalidLinks.length} invalid link(s).`
            : `Loaded ${this.roles.length} account types and ${this.features.length} features.`;
        },
        error: (error: unknown) => {
          this.errorMessage = (error as Error)?.message || 'Failed to load role access map.';
          this.statusMessage = this.errorMessage;
        }
      });
  }

  autoLayout(): void {
    const roleX = 100;
    const featureX = 820;
    const roleGap = 120;
    const featureGap = 100;
    this.roleNodes
      .sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }))
      .forEach((node, index) => {
        node.x = roleX;
        node.y = 80 + index * roleGap;
      });

    this.featureNodes
      .sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }))
      .forEach((node, index) => {
        node.x = featureX + Math.floor(index / 9) * 340;
        node.y = 80 + (index % 9) * featureGap;
      });
    this.updateWorldSize();
    this.statusMessage = 'Auto layout applied.';
  }

  createRole(): void {
    this.errorMessage = '';
    const name = (this.newRoleName || '').trim();
    if (!name) {
      this.errorMessage = 'Role name is required.';
      return;
    }
    this.accessControl.createRole(name, this.newRoleDescription).subscribe({
      next: (role) => {
        this.newRoleName = '';
        this.newRoleDescription = '';
        this.nextSelectionId = `role:${role.name}`;
        this.load(true);
        this.statusMessage = `Created role ${role.name}.`;
      },
      error: (error: unknown) => {
        this.errorMessage = (error as Error)?.message || 'Could not create role.';
        this.statusMessage = this.errorMessage;
      }
    });
  }

  deleteSelectedCustomRole(): void {
    const selected = this.selectedRoleNode;
    if (!selected?.roleName) return;
    const profile = this.roles.find(role => role.name === selected.roleName);
    if (!profile || profile.system) return;

    this.accessControl.deleteCustomRole(selected.roleName).subscribe({
      next: () => {
        this.load(true);
        this.statusMessage = `Deleted role ${selected.roleName}.`;
      },
      error: (error: unknown) => {
        this.errorMessage = (error as Error)?.message || 'Could not delete role.';
        this.statusMessage = this.errorMessage;
      }
    });
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId = nodeId;
  }

  startDrag(event: MouseEvent, node: AccessMapNode): void {
    event.preventDefault();
    event.stopPropagation();
    this.isPanningCanvas = false;
    this.selectedNodeId = node.id;
    this.draggingNodeId = node.id;
    const { x, y } = this.getCanvasPoint(event);
    this.dragOffsetX = x - node.x;
    this.dragOffsetY = y - node.y;
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (this.wireFromRole || this.draggingNodeId) return;
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.node-card') || target.closest('.choice-wire')) return;
    this.isPanningCanvas = true;
    this.panStartX = event.clientX - this.canvasPanX;
    this.panStartY = event.clientY - this.canvasPanY;
    event.preventDefault();
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
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.isPanningCanvas) {
      this.canvasPanX = event.clientX - this.panStartX;
      this.canvasPanY = event.clientY - this.panStartY;
      return;
    }

    const { x, y } = this.getCanvasPoint(event);
    this.wireMouseX = x;
    this.wireMouseY = y;
    if (this.wireFromRole) {
      this.updateWorldSize();
    }

    if (!this.draggingNodeId) return;
    const node = this.nodes.find(item => item.id === this.draggingNodeId);
    if (!node) return;
    node.x = Math.max(8, x - this.dragOffsetX);
    node.y = Math.max(8, y - this.dragOffsetY);
    this.updateWorldSize();
  }

  onCanvasMouseUp(): void {
    this.stopDragAndPan();
    if (this.wireFromRole) {
      this.cancelWire();
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.stopDragAndPan();
    if (this.wireFromRole) {
      this.cancelWire();
    }
  }

  startWire(event: MouseEvent, roleName: string): void {
    event.preventDefault();
    event.stopPropagation();
    const { x, y } = this.getCanvasPoint(event);
    this.wireFromRole = roleName;
    this.wireMouseX = x;
    this.wireMouseY = y;
    this.statusMessage = `Link ${roleName}: drop on a feature node.`;
  }

  completeWire(event: MouseEvent, targetNode: AccessMapNode): void {
    if (!this.wireFromRole) return;
    event.preventDefault();
    event.stopPropagation();
    if (targetNode.kind !== 'FEATURE' || !targetNode.featureKey) {
      this.cancelWire('Invalid target. Drop on a feature node.');
      return;
    }

    this.toggleRoleFeature(this.wireFromRole, targetNode.featureKey);
    this.selectedNodeId = `role:${this.wireFromRole}`;
    this.updateWorldSize();
    this.cancelWire('Access link updated.');
  }

  cancelWire(message = 'Wiring canceled.'): void {
    this.wireFromRole = null;
    this.statusMessage = message;
  }

  toggleSelectedRoleFeature(featureKey: string): void {
    const node = this.selectedRoleNode;
    if (!node?.roleName) return;
    this.toggleRoleFeature(node.roleName, featureKey);
  }

  clearSelectedRoleLinks(): void {
    const node = this.selectedRoleNode;
    if (!node?.roleName) return;
    this.links = this.links.filter(link => link.roleName !== node.roleName);
    this.refreshLinkState();
    this.statusMessage = `Cleared feature links for ${node.roleName}.`;
  }

  isRoleLinked(roleName: string, featureKey: string): boolean {
    return this.visibleLinks.some(link => link.roleName === roleName && link.featureKey === featureKey);
  }

  getRoleFeatureCount(roleName: string): number {
    return this.visibleLinks.filter(link => link.roleName === roleName).length;
  }

  getFeatureRoleCount(featureKey: string): number {
    return this.visibleLinks.filter(link => link.featureKey === featureKey).length;
  }

  getFeatureRoute(featureKey: string | undefined): string {
    if (!featureKey) return '-';
    const feature = this.features.find(item => item.key === featureKey);
    return feature?.route || '-';
  }

  saveToDatabase(): void {
    this.saving = true;
    this.errorMessage = '';
    this.statusMessage = 'Saving access policy...';
    const roleNodeByName = new Map(
      this.roleNodes
        .filter(node => !!node.roleName)
        .map(node => [node.roleName as string, node])
    );

    const roles = this.roles.map(role => {
      const node = roleNodeByName.get(role.name);
      if (!node) return role;
      return { ...role, x: Math.round(node.x), y: Math.round(node.y) };
    });

    const links = [...this.visibleLinks];
    const currentSelection = this.selectedNodeId;
    this.accessControl.saveConfig({ roles, links })
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => {
          this.nextSelectionId = currentSelection;
          this.load(true);
          this.statusMessage = 'Role access map saved.';
        },
        error: (error: unknown) => {
          this.errorMessage = (error as Error)?.message || 'Save failed.';
          this.statusMessage = this.errorMessage;
        }
      });
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

  getConnectionPath(roleName: string, featureKey: string): string {
    const roleNode = this.nodes.find(node => node.id === `role:${roleName}`);
    const featureNode = this.nodes.find(node => node.id === `feature:${featureKey}`);
    if (!roleNode || !featureNode) return '';
    const startX = roleNode.x + 270;
    const startY = roleNode.y + 56;
    const endX = featureNode.x;
    const endY = featureNode.y + 56;
    const controlOffset = Math.max(90, Math.abs(endX - startX) * 0.35);
    const c1x = startX + controlOffset;
    const c1y = startY;
    const c2x = endX - controlOffset;
    const c2y = endY;
    return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
  }

  getLiveWirePath(): string {
    if (!this.wireFromRole) return '';
    const roleNode = this.nodes.find(node => node.id === `role:${this.wireFromRole}`);
    if (!roleNode) return '';
    const startX = roleNode.x + 270;
    const startY = roleNode.y + 56;
    const endX = this.wireMouseX;
    const endY = this.wireMouseY;
    const controlOffset = Math.max(90, Math.abs(endX - startX) * 0.35);
    const c1x = startX + controlOffset;
    const c1y = startY;
    const c2x = endX - controlOffset;
    const c2y = endY;
    return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
  }

  trackNode(_: number, node: AccessMapNode): string {
    return node.id;
  }

  trackLink(_: number, link: AccessRoleLink): string {
    return `${link.roleName}:${link.featureKey}`;
  }

  private buildNodes(): void {
    const roleNodes: AccessMapNode[] = this.roles.map(role => ({
      id: `role:${role.name}`,
      kind: 'ROLE',
      roleName: role.name,
      label: role.name,
      meta: role.description || (role.system ? 'System role' : 'Custom role'),
      x: role.x,
      y: role.y,
      system: role.system
    }));

    const featureNodes: AccessMapNode[] = this.features.map(feature => ({
      id: `feature:${feature.key}`,
      kind: 'FEATURE',
      featureKey: feature.key,
      label: feature.label,
      meta: feature.description,
      x: feature.x,
      y: feature.y
    }));

    this.nodes = [...roleNodes, ...featureNodes];
  }

  private toggleRoleFeature(roleName: string, featureKey: string): void {
    const existing = this.links.find(link => link.roleName === roleName && link.featureKey === featureKey);
    if (existing) {
      this.links = this.links.filter(link => !(link.roleName === roleName && link.featureKey === featureKey));
    } else {
      this.links = [...this.links, { roleName, featureKey }];
    }
    this.refreshLinkState();
  }

  private stopDragAndPan(): void {
    this.draggingNodeId = null;
    this.isPanningCanvas = false;
  }

  private getCanvasPoint(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left - this.canvasPanX) / this.canvasZoom,
      y: (event.clientY - rect.top - this.canvasPanY) / this.canvasZoom
    };
  }

  private refreshLinkState(): void {
    const roleNames = new Set(
      this.roleNodes
        .map(node => node.roleName || '')
        .filter(name => !!name)
    );
    const featureKeys = new Set(
      this.featureNodes
        .map(node => node.featureKey || '')
        .filter(key => !!key)
    );
    const deduped = this.uniqueLinks(this.links);
    this.links = deduped;
    this.visibleLinks = deduped.filter(link => roleNames.has(link.roleName) && featureKeys.has(link.featureKey));
    this.invalidLinks = deduped.filter(link => !roleNames.has(link.roleName) || !featureKeys.has(link.featureKey));
  }

  private uniqueLinks(links: AccessRoleLink[]): AccessRoleLink[] {
    const seen = new Set<string>();
    const out: AccessRoleLink[] = [];
    for (const link of links || []) {
      const roleName = (link.roleName || '').toString().trim().toUpperCase();
      const featureKey = (link.featureKey || '').toString().trim().toLowerCase();
      if (!roleName || !featureKey) continue;
      const key = `${roleName}:${featureKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ roleName, featureKey });
    }
    return out;
  }

  private updateWorldSize(): void {
    let maxX = 0;
    let maxY = 0;
    for (const node of this.nodes) {
      const nodeWidth = node.kind === 'FEATURE' ? 320 : 270;
      const nodeHeight = node.kind === 'FEATURE' ? 116 : 170;
      maxX = Math.max(maxX, node.x + nodeWidth);
      maxY = Math.max(maxY, node.y + nodeHeight);
    }
    if (this.wireFromRole) {
      maxX = Math.max(maxX, this.wireMouseX);
      maxY = Math.max(maxY, this.wireMouseY);
    }
    this.worldWidth = Math.max(2200, Math.ceil(maxX + 420));
    this.worldHeight = Math.max(1600, Math.ceil(maxY + 300));
  }
}
