import { Component, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Cap } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { ImageFingerprintService } from '../../services/image-fingerprint.service';
import { ToastService } from '../../services/toast.service';
import { CapCardComponent } from '../cap-card/cap-card.component';

interface SimilarResult {
  cap: Cap;
  score: number;
}

@Component({
  selector: 'app-similar',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, CapCardComponent],
  templateUrl: './similar.component.html',
  styleUrls: ['./similar.component.scss'],
})
export class SimilarComponent implements AfterViewInit, OnDestroy {
  imagePreview: string | null = null;
  searching = false;
  results: SimilarResult[] = [];
  searched = false;
  isDragging = false;
  indexing = false;
  capsWithoutFingerprint = 0;

  showCrop = false;
  cropCenterX = 0;
  cropCenterY = 0;
  cropRadius = 0;

  private cropMode: 'none' | 'move' | 'resize' = 'none';
  private pointerStartX = 0;
  private pointerStartY = 0;
  private startCX = 0;
  private startCY = 0;
  private startR = 0;

  private boundPointerMove = this.onPointerMove.bind(this);
  private boundPointerUp = this.onPointerUp.bind(this);

  @ViewChild('cropImage') cropImageRef!: ElementRef<HTMLImageElement>;
  @ViewChild('cropContainer') cropContainerRef!: ElementRef<HTMLDivElement>;

  constructor(
    private capService: CapService,
    private fingerprintService: ImageFingerprintService,
    private toastService: ToastService,
    private translateService: TranslateService
  ) {
    this.checkMissingFingerprints();
  }

  ngAfterViewInit(): void {
    document.addEventListener('mousemove', this.boundPointerMove);
    document.addEventListener('mouseup', this.boundPointerUp);
    document.addEventListener('touchmove', this.boundPointerMove, { passive: false });
    document.addEventListener('touchend', this.boundPointerUp);
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.boundPointerMove);
    document.removeEventListener('mouseup', this.boundPointerUp);
    document.removeEventListener('touchmove', this.boundPointerMove);
    document.removeEventListener('touchend', this.boundPointerUp);
  }

  private needsReindex(cap: Cap): boolean {
    return !!(cap.imageUrl && (!cap.fingerprint?.length || cap.fingerprint.length !== 472));
  }

  private checkMissingFingerprints(): void {
    this.capService.caps$.subscribe(caps => {
      this.capsWithoutFingerprint = caps.filter(c => this.needsReindex(c)).length;
    });
  }

  async indexExisting(): Promise<void> {
    this.indexing = true;
    const caps = await firstValueFrom(this.capService.caps$);

    const toIndex = caps.filter(c => this.needsReindex(c));
    let done = 0;

    for (const cap of toIndex) {
      try {
        const fp = await this.fingerprintService.extractFromUrl(cap.imageUrl!);
        await this.capService.updateCap(cap.id, { fingerprint: fp } as any);
        done++;
      } catch {
        console.warn('Failed to index', cap.id);
      }
    }

    this.indexing = false;
    this.capsWithoutFingerprint = Math.max(0, this.capsWithoutFingerprint - done);
    this.toastService.success(
      this.translateService.instant('SIMILAR.INDEXED', { count: done })
    );
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.loadPreview(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      this.loadPreview(file);
    }
  }

  private loadPreview(file: File): void {
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
      this.showCrop = false;
      this.searched = false;
      this.results = [];
    };
    reader.readAsDataURL(file);
  }

  private selectedFile: File | null = null;

  onImageLoaded(): void {
    const img = this.cropImageRef.nativeElement;
    const w = img.clientWidth;
    const h = img.clientHeight;
    this.cropCenterX = w / 2;
    this.cropCenterY = h / 2;
    this.cropRadius = Math.min(w, h) * 0.4;
    this.showCrop = true;
  }

  // --- Crop interaction ---

  onCropPointerDown(event: MouseEvent | TouchEvent): void {
    if (!this.showCrop) return;
    event.preventDefault();

    const pos = this.getClientPos(event);
    const rect = this.cropContainerRef.nativeElement.getBoundingClientRect();
    const x = pos.x - rect.left;
    const y = pos.y - rect.top;

    const dist = Math.sqrt((x - this.cropCenterX) ** 2 + (y - this.cropCenterY) ** 2);

    if (Math.abs(dist - this.cropRadius) < 20) {
      this.cropMode = 'resize';
    } else if (dist < this.cropRadius) {
      this.cropMode = 'move';
    } else {
      return;
    }

    this.pointerStartX = pos.x;
    this.pointerStartY = pos.y;
    this.startCX = this.cropCenterX;
    this.startCY = this.cropCenterY;
    this.startR = this.cropRadius;
  }

  private onPointerMove(event: MouseEvent | TouchEvent): void {
    if (this.cropMode === 'none') return;
    event.preventDefault();

    const pos = this.getClientPos(event);
    const dx = pos.x - this.pointerStartX;
    const dy = pos.y - this.pointerStartY;

    const img = this.cropImageRef?.nativeElement;
    if (!img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;

    if (this.cropMode === 'move') {
      this.cropCenterX = this.clamp(this.startCX + dx, this.cropRadius, w - this.cropRadius);
      this.cropCenterY = this.clamp(this.startCY + dy, this.cropRadius, h - this.cropRadius);
    } else if (this.cropMode === 'resize') {
      const rect = this.cropContainerRef.nativeElement.getBoundingClientRect();
      const mx = pos.x - rect.left;
      const my = pos.y - rect.top;
      const newR = Math.sqrt((mx - this.cropCenterX) ** 2 + (my - this.cropCenterY) ** 2);
      const maxR = Math.min(
        this.cropCenterX, w - this.cropCenterX,
        this.cropCenterY, h - this.cropCenterY
      );
      this.cropRadius = this.clamp(newR, 30, maxR);
    }
  }

  private onPointerUp(): void {
    this.cropMode = 'none';
  }

  onCropWheel(event: WheelEvent): void {
    if (!this.showCrop) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -10 : 10;
    const img = this.cropImageRef.nativeElement;
    const w = img.clientWidth;
    const h = img.clientHeight;
    const maxR = Math.min(
      this.cropCenterX, w - this.cropCenterX,
      this.cropCenterY, h - this.cropCenterY
    );
    this.cropRadius = this.clamp(this.cropRadius + delta, 30, maxR);
  }

  // --- Search ---

  async searchWithCrop(): Promise<void> {
    this.searching = true;
    this.searched = false;
    this.results = [];

    try {
      const croppedCanvas = this.extractCroppedCanvas();
      const blob = await new Promise<Blob>((resolve, reject) => {
        croppedCanvas.toBlob(b => b ? resolve(b) : reject('toBlob failed'), 'image/jpeg', 0.92);
      });
      const file = new File([blob], 'crop.jpg', { type: 'image/jpeg' });

      const queryFp = await this.fingerprintService.extractFromFile(file);
      const caps = await firstValueFrom(this.capService.caps$);

      const scored: SimilarResult[] = caps
        .filter(c => c.fingerprint?.length)
        .map(cap => ({
          cap,
          score: this.fingerprintService.distance(queryFp, cap.fingerprint!),
        }))
        .sort((a, b) => a.score - b.score);

      this.results = scored.slice(0, 20);
    } catch (err) {
      console.error('Similar search failed:', err);
      this.toastService.error(this.translateService.instant('SIMILAR.ERROR'));
    }

    this.searching = false;
    this.searched = true;
    this.showCrop = false;
  }

  private extractCroppedCanvas(): HTMLCanvasElement {
    const img = this.cropImageRef.nativeElement;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const natCX = this.cropCenterX * scaleX;
    const natCY = this.cropCenterY * scaleY;
    const natRX = this.cropRadius * scaleX;
    const natRY = this.cropRadius * scaleY;
    const natR = Math.max(natRX, natRY);

    const diameter = Math.round(natR * 2);
    const canvas = document.createElement('canvas');
    canvas.width = diameter;
    canvas.height = diameter;
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    ctx.arc(natR, natR, natR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      img,
      natCX - natR, natCY - natR, diameter, diameter,
      0, 0, diameter, diameter
    );

    return canvas;
  }

  reset(): void {
    this.imagePreview = null;
    this.selectedFile = null;
    this.results = [];
    this.searched = false;
    this.showCrop = false;
  }

  getSimilarityPercent(score: number): number {
    return Math.round((1 - score) * 100);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private getClientPos(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if ('touches' in event && event.touches.length) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    if ('changedTouches' in event && event.changedTouches.length) {
      return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    }
    const me = event as MouseEvent;
    return { x: me.clientX, y: me.clientY };
  }
}
