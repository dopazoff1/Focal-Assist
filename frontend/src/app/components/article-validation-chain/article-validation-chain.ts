import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { KbValidationUser } from '../../services/kb';

@Component({
  selector: 'app-article-validation-chain',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './article-validation-chain.html',
  styleUrls: ['./article-validation-chain.css']
})
export class ArticleValidationChainComponent implements OnChanges {
  @Input() users: KbValidationUser[] = [];
  @Input() selectedUserIds: number[] = [];
  @Output() selectedUserIdsChange = new EventEmitter<number[]>();
  @ViewChild('canvasRef') canvasRef?: ElementRef<HTMLDivElement>;
  draggingUserId: number | null = null;
  isPanningCanvas = false;
  canvasPanX = 0;
  canvasPanY = 0;
  canvasZoom = 1;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private readonly positions = new Map<number, { x: number; y: number }>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedUserIds'] || changes['users']) {
      this.selectedUserIds.forEach((id, index) => {
        if (!this.positions.has(id)) {
          this.positions.set(id, { x: 80 + index * 360, y: 60 });
        }
      });
      const selected = new Set(this.selectedUserIds);
      [...this.positions.keys()].forEach(id => {
        if (!selected.has(id)) this.positions.delete(id);
      });
    }
  }

  get selectedUsers(): KbValidationUser[] {
    const usersById = new Map(this.users.map(user => [user.id, user]));
    return this.selectedUserIds.map(id => usersById.get(id)).filter((user): user is KbValidationUser => !!user);
  }

  get worldWidth(): number {
    return Math.max(1100, this.selectedUserIds.length * 360 + 420);
  }

  getPosition(userId: number, index = 0): { x: number; y: number } {
    return this.positions.get(userId) || { x: 80 + index * 360, y: 60 };
  }

  selectUser(userId: number): void {
    this.activeUserId = userId;
  }

  activeUserId: number | null = null;

  startDrag(event: MouseEvent, user: KbValidationUser, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.isPanningCanvas = false;
    this.activeUserId = user.id;
    this.draggingUserId = user.id;
    const point = this.getCanvasPoint(event);
    const position = this.getPosition(user.id, index);
    this.dragOffsetX = point.x - position.x;
    this.dragOffsetY = point.y - position.y;
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (this.draggingUserId !== null || event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.node-card')) return;
    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    this.isPanningCanvas = true;
    this.panStartX = event.clientX - this.canvasPanX;
    this.panStartY = event.clientY - this.canvasPanY;
    event.preventDefault();
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.isPanningCanvas) {
      this.canvasPanX = event.clientX - this.panStartX;
      this.canvasPanY = event.clientY - this.panStartY;
      return;
    }
    if (this.draggingUserId === null) return;
    const point = this.getCanvasPoint(event);
    this.positions.set(this.draggingUserId, {
      x: Math.max(8, point.x - this.dragOffsetX),
      y: Math.max(8, point.y - this.dragOffsetY)
    });
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
  }

  onCanvasMouseUp(): void {
    this.draggingUserId = null;
    this.isPanningCanvas = false;
    this.emitPositionOrder();
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    this.onCanvasMouseUp();
  }

  getCanvasPoint(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (!rect) return { x: event.clientX, y: event.clientY };
    return {
      x: (event.clientX - rect.left - this.canvasPanX) / this.canvasZoom,
      y: (event.clientY - rect.top - this.canvasPanY) / this.canvasZoom
    };
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

  getConnectionPath(index: number): string {
    const source = this.selectedUsers[index];
    const target = this.selectedUsers[index + 1];
    if (!source || !target) return '';
    const start = this.getPosition(source.id, index);
    const end = this.getPosition(target.id, index + 1);
    const startX = start.x + 296;
    const startY = start.y + 63;
    const endX = end.x;
    const endY = end.y + 63;
    const controlOffset = Math.max(70, Math.abs(endX - startX) * 0.35);
    return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
  }

  private emitPositionOrder(): void {
    const ordered = [...this.selectedUserIds].sort((a, b) => {
      const left = this.getPosition(a);
      const right = this.getPosition(b);
      return left.x - right.x || left.y - right.y;
    });
    if (ordered.some((id, index) => id !== this.selectedUserIds[index])) {
      this.selectedUserIdsChange.emit(ordered);
    }
  }

  trackByUser(_: number, user: KbValidationUser): number {
    return user.id;
  }

}
