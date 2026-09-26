import { CommonModule } from '@angular/common';
import { ApplicationRef, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import {
  ProcessAssistantRole,
  ProcessAssistantService,
  PromptMapConfig,
  PromptProfile,
  PromptRoleLink,
  SUPPORTED_ROLES
} from '../../services/process-assistant';

interface RoleCanvasNode {
  role: ProcessAssistantRole;
  x: number;
  y: number;
}

@Component({
  selector: 'app-prompt-map-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prompt-map-builder.html',
  styleUrls: ['./prompt-map-builder.css']
})
export class PromptMapBuilderComponent implements OnInit {
  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLDivElement>;

  loading = false;
  saving = false;
  statusMessage = '';
  lastSaveErrorDetails = '';

  roleNodes: RoleCanvasNode[] = [];
  profiles: PromptProfile[] = [];
  links: PromptRoleLink[] = [];

  selectedProfileId: number | null = null;

  draggingProfileId: number | null = null;
  dragOffsetX = 0;
  dragOffsetY = 0;

  wireFromRole: ProcessAssistantRole | null = null;
  wireMouseX = 0;
  wireMouseY = 0;

  isPanningCanvas = false;
  canvasPanX = 0;
  canvasPanY = 0;
  canvasZoom = 1;
  private panStartX = 0;
  private panStartY = 0;

  constructor(
    private processAssistant: ProcessAssistantService,
    private cdr: ChangeDetectorRef,
    private appRef: ApplicationRef
  ) {
    this.roleNodes = SUPPORTED_ROLES.map((role, idx) => ({
      role,
      x: 90,
      y: 80 + idx * 170
    }));
  }

  get selectedProfile(): PromptProfile | undefined {
    return this.profiles.find(p => p.id === this.selectedProfileId);
  }

  ngOnInit(): void {
    void this.loadMap();
  }

  async loadMap(): Promise<void> {
    this.loading = true;
    this.statusMessage = 'Loading prompt map...';
    this.lastSaveErrorDetails = '';
    try {
      const map = await this.processAssistant.getPromptMap();
      this.applyMap(map);
      this.statusMessage = `Loaded ${this.profiles.length} prompt types and ${this.links.length} links.`;
    } catch (error: unknown) {
      this.statusMessage = (error as Error)?.message || 'Failed to load prompt map.';
    } finally {
      this.loading = false;
      this.requestMapRefresh();
    }
  }

  autoLayout(): void {
    this.profiles
      .sort((a, b) => a.id - b.id)
      .forEach((profile, idx) => {
        profile.xPos = 560 + Math.floor(idx / 6) * 430;
        profile.yPos = 80 + (idx % 6) * 170;
      });
    this.statusMessage = 'Auto layout applied.';
    this.requestMapRefresh();
  }

  addPromptType(): void {
    const nextId = this.nextProfileId();
    const now = new Date().toISOString();
    const node: PromptProfile = {
      id: nextId,
      name: `Prompt ${nextId}`,
      systemPrompt: 'Define the assistant behavior for this account type.',
      model: 'gpt-4o-mini',
      apiKey: '',
      temperature: 0.2,
      maxTokens: 900,
      active: true,
      xPos: 560,
      yPos: 80 + (this.profiles.length % 6) * 170,
      createdAt: now,
      updatedAt: now
    };
    this.profiles.push(node);
    this.selectedProfileId = node.id;
    this.statusMessage = 'Prompt type created.';
    this.requestMapRefresh();
  }

  deleteSelectedPrompt(): void {
    if (!this.selectedProfileId) return;
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Delete this prompt type and all role links to it?')
      : true;
    if (!confirmed) return;

    const targetId = this.selectedProfileId;
    this.profiles = this.profiles.filter(p => p.id !== targetId);
    this.links = this.links.filter(link => link.promptProfileId !== targetId);
    this.selectedProfileId = this.profiles[0]?.id ?? null;
    this.statusMessage = 'Prompt type deleted.';
    this.requestMapRefresh();
  }

  selectProfile(profileId: number): void {
    this.selectedProfileId = profileId;
    this.requestMapRefresh();
  }

  onProfileEdited(): void {
    const profile = this.selectedProfile;
    if (!profile) return;
    profile.updatedAt = new Date().toISOString();
    this.requestMapRefresh();
  }

  startWire(event: MouseEvent, role: ProcessAssistantRole): void {
    event.preventDefault();
    event.stopPropagation();
    const point = this.getCanvasPoint(event);
    this.wireFromRole = role;
    this.wireMouseX = point.x;
    this.wireMouseY = point.y;
    this.statusMessage = `Link ${this.labelForRole(role)}: drop on a prompt node.`;
    this.requestMapRefresh();
  }

  completeWire(event: MouseEvent, profile: PromptProfile): void {
    if (!this.wireFromRole) return;
    event.preventDefault();
    event.stopPropagation();
    const linkExists = this.links.some(link => link.role === this.wireFromRole && link.promptProfileId === profile.id);
    if (!linkExists) {
      this.links.push({ role: this.wireFromRole, promptProfileId: profile.id });
      this.statusMessage = `${this.labelForRole(this.wireFromRole)} linked to "${profile.name}".`;
    } else {
      this.statusMessage = 'Link already exists.';
    }
    this.wireFromRole = null;
    this.selectedProfileId = profile.id;
    this.requestMapRefresh();
  }

  removeRoleLink(role: ProcessAssistantRole, promptProfileId: number): void {
    this.links = this.links.filter(link => !(link.role === role && link.promptProfileId === promptProfileId));
    this.statusMessage = `${this.labelForRole(role)} link removed.`;
    this.requestMapRefresh();
  }

  clearRole(role: ProcessAssistantRole): void {
    this.links = this.links.filter(link => link.role !== role);
    this.statusMessage = `${this.labelForRole(role)} links cleared.`;
    this.requestMapRefresh();
  }

  getLinkedProfiles(role: ProcessAssistantRole): PromptProfile[] {
    const ids = this.links
      .filter(link => link.role === role)
      .map(link => link.promptProfileId);
    const idSet = new Set(ids);
    return this.profiles.filter(profile => idSet.has(profile.id));
  }

  startDragProfile(event: MouseEvent, profile: PromptProfile): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedProfileId = profile.id;
    this.draggingProfileId = profile.id;
    this.isPanningCanvas = false;
    const point = this.getCanvasPoint(event);
    this.dragOffsetX = point.x - profile.xPos;
    this.dragOffsetY = point.y - profile.yPos;
    this.requestMapRefresh();
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (this.wireFromRole || this.draggingProfileId) return;
    if (event.button !== 0 && event.button !== 1) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.prompt-card') || target.closest('.role-card') || target.closest('.choice-wire')) return;

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
    const nextZoom = Math.min(2.5, Math.max(0.35, this.canvasZoom * zoomFactor));
    if (nextZoom === this.canvasZoom) return;

    this.canvasZoom = nextZoom;
    this.canvasPanX = pointerX - worldX * nextZoom;
    this.canvasPanY = pointerY - worldY * nextZoom;
    this.requestMapRefresh();
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.isPanningCanvas) {
      this.canvasPanX = event.clientX - this.panStartX;
      this.canvasPanY = event.clientY - this.panStartY;
      this.requestMapRefresh();
      return;
    }

    const point = this.getCanvasPoint(event);
    this.wireMouseX = point.x;
    this.wireMouseY = point.y;

    if (this.wireFromRole) {
      this.requestMapRefresh();
    }

    if (!this.draggingProfileId) return;
    const profile = this.profiles.find(p => p.id === this.draggingProfileId);
    if (!profile) return;
    profile.xPos = Math.max(260, point.x - this.dragOffsetX);
    profile.yPos = Math.max(12, point.y - this.dragOffsetY);
    profile.updatedAt = new Date().toISOString();
    this.requestMapRefresh();
  }

  onCanvasMouseUp(): void {
    this.stopDrag();
    this.stopPan();
    if (this.wireFromRole) {
      this.wireFromRole = null;
      this.statusMessage = 'Wiring canceled.';
      this.requestMapRefresh();
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.stopDrag();
    this.stopPan();
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

  getRoleConnectionPath(link: PromptRoleLink): string {
    const roleNode = this.roleNodes.find(r => r.role === link.role);
    const profile = this.profiles.find(p => p.id === link.promptProfileId);
    if (!roleNode || !profile) return '';

    const startX = roleNode.x + 296;
    const startY = roleNode.y + 58;
    const endX = profile.xPos;
    const endY = profile.yPos + 58;
    const controlOffset = Math.max(70, Math.abs(endX - startX) * 0.35);
    return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
  }

  getLiveWirePath(): string {
    if (!this.wireFromRole) return '';
    const roleNode = this.roleNodes.find(r => r.role === this.wireFromRole);
    if (!roleNode) return '';

    const startX = roleNode.x + 296;
    const startY = roleNode.y + 58;
    const endX = this.wireMouseX;
    const endY = this.wireMouseY;
    const controlOffset = Math.max(70, Math.abs(endX - startX) * 0.35);
    return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
  }

  labelForRole(role: ProcessAssistantRole): string {
    if (role === 'TEAM_LEADER') return 'Team Leader';
    if (role === 'HEAD_CS') return 'Head of CS';
    return role.replace('_', ' ');
  }

  async saveToDatabase(): Promise<void> {
    if (!this.profiles.length) {
      this.statusMessage = 'Add at least one prompt type before saving.';
      return;
    }

    const invalidApiKeyProfile = this.profiles.find(profile => {
      const key = (profile.apiKey || '').toString().trim();
      return key.length > 0 && !key.startsWith('sk-');
    });
    if (invalidApiKeyProfile) {
      this.statusMessage =
        `Prompt "${invalidApiKeyProfile.name}" has an invalid API key format. Use a real OpenAI key starting with sk-.`;
      return;
    }

    this.saving = true;
    this.lastSaveErrorDetails = '';
    this.statusMessage = 'Saving prompt map...';
    try {
      const payload: PromptMapConfig = {
        profiles: this.profiles.map(profile => ({
          ...profile,
          apiKey: (profile.apiKey || '').toString().trim(),
          temperature: Math.max(0, Math.min(2, Number(profile.temperature || 0.2))),
          maxTokens: Math.max(128, Math.min(4096, Math.round(Number(profile.maxTokens || 900)))),
          updatedAt: new Date().toISOString()
        })),
        links: this.deduplicatedLinks()
      };
      const saved = await this.processAssistant.savePromptMap(payload);
      this.applyMap(saved);
      this.statusMessage = 'Prompt map saved.';
    } catch (error: unknown) {
      const httpError = error as HttpErrorResponse;
      const apiMessage =
        typeof httpError?.error === 'string'
          ? httpError.error
          : (httpError?.error?.message as string | undefined) || (httpError?.error?.error as string | undefined);
      const genericMessage = (error as Error)?.message || httpError?.message || 'Unknown error';

      if (httpError?.status) {
        this.statusMessage = apiMessage
          ? `Failed to save (${httpError.status}): ${apiMessage}`
          : `Failed to save (${httpError.status}).`;
      } else {
        this.statusMessage = `Failed to save: ${apiMessage || genericMessage}`;
      }

      const errorBody =
        httpError?.error === undefined
          ? '(empty)'
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
        errorBody,
        '',
        'stack:',
        (error as Error)?.stack || '(no stack)'
      ].join('\n');
    } finally {
      this.saving = false;
      this.requestMapRefresh();
    }
  }

  private applyMap(map: PromptMapConfig): void {
    this.profiles = [...map.profiles].sort((a, b) => a.id - b.id);
    this.links = [...map.links];
    if (!this.profiles.some(p => p.id === this.selectedProfileId)) {
      this.selectedProfileId = this.profiles[0]?.id ?? null;
    }
    if (!this.profiles.length) {
      this.selectedProfileId = null;
    }
    this.requestMapRefresh();
  }

  private deduplicatedLinks(): PromptRoleLink[] {
    const profileIds = new Set(this.profiles.map(p => p.id));
    const seen = new Set<string>();
    const output: PromptRoleLink[] = [];
    for (const link of this.links) {
      if (!profileIds.has(link.promptProfileId)) continue;
      const key = `${link.role}:${link.promptProfileId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(link);
    }
    return output;
  }

  private nextProfileId(): number {
    const max = this.profiles.reduce((acc, item) => Math.max(acc, item.id), 0);
    return max + 1;
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

  private stopDrag(): void {
    this.draggingProfileId = null;
    this.requestMapRefresh();
  }

  private stopPan(): void {
    this.isPanningCanvas = false;
    this.requestMapRefresh();
  }

  private requestMapRefresh(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.appRef.tick();
  }
}
