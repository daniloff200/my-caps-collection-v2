import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Cap } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { ToastService } from '../../services/toast.service';
import { ImageUploadService } from '../../services/image-upload.service';
import { COUNTRIES } from '../../data/countries';
import { COMMON_TAGS } from '../../data/tags';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';

@Component({
  selector: 'app-cap-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TagBadgeComponent],
  templateUrl: './cap-form.component.html',
  styleUrls: ['./cap-form.component.scss'],
})
export class CapFormComponent implements OnInit {
  isEditMode = false;
  capId: string | null = null;
  saving = false;

  name = '';
  country = '';
  manufacturer = '';
  tags: string[] = [];
  imageUrl = '';
  description = '';
  forTrade = false;

  // Image upload
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  isDragging = false;
  compressedSize: number | null = null;
  originalSize: number | null = null;
  compressing = false;

  customTag = '';
  countries = COUNTRIES;
  commonTags = COMMON_TAGS;
  showTagSuggestions = false;

  constructor(
    private capService: CapService,
    private toastService: ToastService,
    private imageUploadService: ImageUploadService,
    private translateService: TranslateService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
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
        this.forTrade = cap.forTrade;
      }
    }
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

  // --- Image upload methods ---

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

  async handleFile(file: File): Promise<void> {
    this.selectedFile = file;
    this.originalSize = file.size;
    this.compressedSize = null;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Compress to show expected size
    this.compressing = true;
    try {
      const compressed = await this.imageUploadService.compressImage(file);
      this.compressedSize = compressed.size;
    } catch {
      // Compression preview failed, still ok
    }
    this.compressing = false;
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

      if (this.isEditMode && this.capId) {
        // Upload new image if selected
        if (this.selectedFile) {
          finalImageUrl = await this.imageUploadService.uploadCapImage(
            this.selectedFile,
            this.capId
          );
        }

        const capData = {
          name: this.name.trim(),
          country: this.country,
          manufacturer: this.manufacturer.trim(),
          tags: this.tags,
          imageUrl: finalImageUrl,
          description: this.description.trim(),
          forTrade: this.forTrade,
        };

        await this.capService.updateCap(this.capId, capData);
        this.toastService.success(this.translateService.instant('TOAST.CAP_UPDATED'));
        this.router.navigate(['/cap', this.capId]);
      } else {
        // Add new cap first (to get the ID), then upload image
        const capData = {
          name: this.name.trim(),
          country: this.country,
          manufacturer: this.manufacturer.trim(),
          tags: this.tags,
          imageUrl: '',
          description: this.description.trim(),
          forTrade: this.forTrade,
        };

        const newCap = await this.capService.addCap(capData as Omit<Cap, 'id' | 'dateAdded'>);

        // Upload image if selected
        if (this.selectedFile) {
          finalImageUrl = await this.imageUploadService.uploadCapImage(
            this.selectedFile,
            newCap.id
          );
          await this.capService.updateCap(newCap.id, { imageUrl: finalImageUrl });
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
}
