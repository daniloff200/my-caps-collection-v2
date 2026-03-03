import { Component } from '@angular/core';
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
export class SimilarComponent {
  imagePreview: string | null = null;
  searching = false;
  results: SimilarResult[] = [];
  searched = false;
  isDragging = false;
  indexing = false;
  capsWithoutFingerprint = 0;

  constructor(
    private capService: CapService,
    private fingerprintService: ImageFingerprintService,
    private toastService: ToastService,
    private translateService: TranslateService
  ) {
    this.checkMissingFingerprints();
  }

  private needsReindex(cap: Cap): boolean {
    return !!(cap.imageUrl && (!cap.fingerprint?.length || cap.fingerprint.length < 3000));
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

    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      this.handleFile(file);
    }
  }

  async handleFile(file: File): Promise<void> {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    this.searching = true;
    this.searched = false;
    this.results = [];

    try {
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
  }

  reset(): void {
    this.imagePreview = null;
    this.results = [];
    this.searched = false;
  }

  getSimilarityPercent(score: number): number {
    return Math.round((1 - score) * 100);
  }
}
