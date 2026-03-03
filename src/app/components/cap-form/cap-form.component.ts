import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Cap } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { ToastService } from '../../services/toast.service';
import { ImageUploadService } from '../../services/image-upload.service';
import { COUNTRIES } from '../../data/countries';
import { COMMON_TAGS } from '../../data/tags';
import { CAP_COLORS, CapColor } from '../../data/colors';
import { ImageFingerprintService } from '../../services/image-fingerprint.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
import { CountryFlagEmojiPipe } from '../../pipes/country-flag-emoji.pipe';

@Component({
  selector: 'app-cap-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TagBadgeComponent, CountryFlagEmojiPipe],
  templateUrl: './cap-form.component.html',
  styleUrls: ['./cap-form.component.scss'],
})
export class CapFormComponent implements OnInit, OnDestroy {
  isEditMode = false;
  capId: string | null = null;
  saving = false;

  name = '';
  country = '';
  manufacturer = '';
  tags: string[] = [];
  imageUrl = '';
  description = '';
  colors: string[] = [];
  forTrade = false;
  needsReplacement = false;
  cciUrl = '';

  selectedFile: File | null = null;
  imagePreview: string | null = null;
  isDragging = false;
  compressedSize: number | null = null;
  originalSize: number | null = null;
  compressing = false;

  // Crop state
  showCropStage = false;
  rawCropPreview: string | null = null;
  cropReady = false;
  cropCenterX = 0;
  cropCenterY = 0;
  cropRadius = 0;

  private cropMode: 'none' | 'move' | 'resize' = 'none';
  private pointerStartX = 0;
  private pointerStartY = 0;
  private startCX = 0;
  private startCY = 0;

  @ViewChild('cropImage') cropImageRef?: ElementRef<HTMLImageElement>;
  @ViewChild('cropContainer') cropContainerRef?: ElementRef<HTMLDivElement>;

  private boundPointerMove = this.onPointerMove.bind(this);
  private boundPointerUp = this.onPointerUp.bind(this);

  customTag = '';
  countries = COUNTRIES;
  commonTags = COMMON_TAGS;
  capColors = CAP_COLORS;
  showTagSuggestions = false;

  constructor(
    private capService: CapService,
    private toastService: ToastService,
    private imageUploadService: ImageUploadService,
    private fingerprintService: ImageFingerprintService,
    private translateService: TranslateService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    document.addEventListener('mousemove', this.boundPointerMove);
    document.addEventListener('mouseup', this.boundPointerUp);
    document.addEventListener('touchmove', this.boundPointerMove, { passive: false });
    document.addEventListener('touchend', this.boundPointerUp);

    this.capId = this.route.snapshot.paramMap.get('id');
    if (this.capId) {
      const cap = await this.capService.getCapByIdAsync(this.capId);
      if (cap) {
        this.isEditMode = true;
        this.name = cap.name;
        this.country = cap.country;
        this.manufacturer = cap.manufacturer;
        this.tags = [...cap.tags];
        this.imageUrl = cap.imageUrl || '';
        this.description = cap.description || '';
        this.colors = cap.colors ? [...cap.colors] : [];
        this.forTrade = cap.forTrade;
        this.needsReplacement = cap.needsReplacement ?? false;
        this.cciUrl = cap.cciUrl || '';
      }
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.boundPointerMove);
    document.removeEventListener('mouseup', this.boundPointerUp);
    document.removeEventListener('touchmove', this.boundPointerMove);
    document.removeEventListener('touchend', this.boundPointerUp);
  }

  get filteredSuggestions(): string[] {
    if (!this.customTag) return this.commonTags.filter((t) => !this.tags.includes(t));
    const search = this.customTag.toLowerCase();
    return this.commonTags.filter(
      (t) => t.toLowerCase().includes(search) && !this.tags.includes(t)
    );
  }

  addTag(tag: string): void {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !this.tags.includes(trimmed)) {
      this.tags.push(trimmed);
    }
    this.customTag = '';
    this.showTagSuggestions = false;
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  toggleColor(colorId: string): void {
    const idx = this.colors.indexOf(colorId);
    if (idx >= 0) {
      this.colors.splice(idx, 1);
    } else {
      this.colors.push(colorId);
    }
  }

  onTagInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.customTag.trim()) {
        this.addTag(this.customTag);
      }
    }
  }

  onTagInputFocus(): void {
    this.showTagSuggestions = true;
  }

  onTagInputBlur(): void {
    setTimeout(() => (this.showTagSuggestions = false), 200);
  }

  // --- Image upload ---

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.handleFile(input.files[0]);
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

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        this.handleFile(file);
      } else {
        this.toastService.error(this.translateService.instant('TOAST.DROP_IMAGE'));
      }
    }
  }

  handleFile(file: File): void {
    this.cropReady = false;
    this.selectedFile = null;
    this.imagePreview = null;
    this.compressedSize = null;
    this.originalSize = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.rawCropPreview = e.target?.result as string;
      this.showCropStage = true;
    };
    reader.readAsDataURL(file);
  }

  onCropImageLoaded(): void {
    const img = this.cropImageRef?.nativeElement;
    if (!img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    this.cropCenterX = w / 2;
    this.cropCenterY = h / 2;
    this.cropRadius = Math.min(w, h) * 0.4;
    this.cropReady = true;
  }

  // --- Crop interaction ---

  onCropPointerDown(event: MouseEvent | TouchEvent): void {
    if (!this.cropReady) return;
    event.preventDefault();

    const pos = this.getClientPos(event);
    const container = this.cropContainerRef?.nativeElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
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
  }

  private onPointerMove(event: MouseEvent | TouchEvent): void {
    if (this.cropMode === 'none') return;
    event.preventDefault();

    const pos = this.getClientPos(event);
    const img = this.cropImageRef?.nativeElement;
    if (!img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;

    if (this.cropMode === 'move') {
      const dx = pos.x - this.pointerStartX;
      const dy = pos.y - this.pointerStartY;
      this.cropCenterX = this.clamp(this.startCX + dx, this.cropRadius, w - this.cropRadius);
      this.cropCenterY = this.clamp(this.startCY + dy, this.cropRadius, h - this.cropRadius);
    } else if (this.cropMode === 'resize') {
      const container = this.cropContainerRef?.nativeElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
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
    if (!this.cropReady) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -10 : 10;
    const img = this.cropImageRef?.nativeElement;
    if (!img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    const maxR = Math.min(
      this.cropCenterX, w - this.cropCenterX,
      this.cropCenterY, h - this.cropCenterY
    );
    this.cropRadius = this.clamp(this.cropRadius + delta, 30, maxR);
  }

  async confirmCrop(): Promise<void> {
    const canvas = this.extractCroppedCanvas();
    if (!canvas) return;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject('toBlob failed'), 'image/jpeg', 0.92);
    });

    this.selectedFile = new File([blob], 'cap-cropped.jpg', { type: 'image/jpeg' });
    this.originalSize = blob.size;
    this.imagePreview = canvas.toDataURL('image/jpeg', 0.92);
    this.showCropStage = false;
    this.rawCropPreview = null;
    this.cropReady = false;

    this.compressing = true;
    try {
      const compressed = await this.imageUploadService.compressImage(this.selectedFile);
      this.compressedSize = compressed.size;
    } catch { /* ok */ }
    this.compressing = false;
  }

  private extractCroppedCanvas(): HTMLCanvasElement | null {
    const img = this.cropImageRef?.nativeElement;
    if (!img) return null;

    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const natCX = this.cropCenterX * scaleX;
    const natCY = this.cropCenterY * scaleY;
    const natR = this.cropRadius * Math.max(scaleX, scaleY);

    const diameter = Math.round(natR * 2);
    const canvas = document.createElement('canvas');
    canvas.width = diameter;
    canvas.height = diameter;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(
      img,
      natCX - natR, natCY - natR, diameter, diameter,
      0, 0, diameter, diameter
    );

    return canvas;
  }

  cancelCrop(): void {
    this.showCropStage = false;
    this.rawCropPreview = null;
    this.cropReady = false;
  }

  removeImage(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.compressedSize = null;
    this.originalSize = null;
    this.imageUrl = '';
  }

  formatSize(bytes: number): string {
    return this.imageUploadService.formatFileSize(bytes);
  }

  // --- Submit ---

  async onSubmit(form: NgForm): Promise<void> {
    if (form.invalid) {
      Object.values(form.controls).forEach((control) => control.markAsTouched());
      this.toastService.error(this.translateService.instant('TOAST.FILL_REQUIRED'));
      return;
    }

    this.saving = true;

    try {
      let finalImageUrl = this.imageUrl;

      let fingerprint: number[] | undefined;
      if (this.selectedFile) {
        try {
          fingerprint = await this.fingerprintService.extractFromFile(this.selectedFile);
        } catch { /* non-critical */ }
      }

      if (this.isEditMode && this.capId) {
        if (this.selectedFile) {
          finalImageUrl = await this.imageUploadService.uploadCapImage(
            this.selectedFile,
            this.capId
          );
        }

        const capData: Record<string, any> = {
          name: this.name.trim(),
          country: this.country,
          manufacturer: this.manufacturer.trim(),
          tags: this.tags,
          colors: this.colors,
          imageUrl: finalImageUrl,
          description: this.description.trim(),
          forTrade: this.forTrade,
          needsReplacement: this.needsReplacement,
          cciUrl: this.cciUrl.trim(),
        };
        if (fingerprint) capData['fingerprint'] = fingerprint;

        await this.capService.updateCap(this.capId, capData);
        this.toastService.success(this.translateService.instant('TOAST.CAP_UPDATED'));
        this.router.navigate(['/cap', this.capId]);
      } else {
        const capData = {
          name: this.name.trim(),
          country: this.country,
          manufacturer: this.manufacturer.trim(),
          tags: this.tags,
          colors: this.colors,
          imageUrl: '',
          description: this.description.trim(),
          forTrade: this.forTrade,
          needsReplacement: this.needsReplacement,
          cciUrl: this.cciUrl.trim(),
        };

        const newCap = await this.capService.addCap(capData as Omit<Cap, 'id' | 'dateAdded'>);

        if (this.selectedFile) {
          finalImageUrl = await this.imageUploadService.uploadCapImage(
            this.selectedFile,
            newCap.id
          );
          const updateData: Record<string, any> = { imageUrl: finalImageUrl };
          if (fingerprint) updateData['fingerprint'] = fingerprint;
          await this.capService.updateCap(newCap.id, updateData);
        }

        this.toastService.success(this.translateService.instant('TOAST.CAP_ADDED'));
        this.router.navigate(['/cap', newCap.id]);
      }
    } catch (err) {
      console.error('Error saving cap:', err);
      this.toastService.error(this.translateService.instant('TOAST.SAVE_FAILED'));
      this.saving = false;
    }
  }

  cancel(): void {
    if (this.isEditMode && this.capId) {
      this.router.navigate(['/cap', this.capId]);
    } else {
      this.router.navigate(['/']);
    }
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
