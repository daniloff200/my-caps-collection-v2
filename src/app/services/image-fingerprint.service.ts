import { Injectable } from '@angular/core';

const DHASH_SIZE = 17; // 17x16 grid → 16x16 = 256 gradient bits
const HIST_BINS = 6;
const HIST_LENGTH = HIST_BINS * HIST_BINS * HIST_BINS; // 216
const DHASH_LENGTH = (DHASH_SIZE - 1) * (DHASH_SIZE - 1); // 256
const TOTAL_LENGTH = DHASH_LENGTH + HIST_LENGTH; // 472

@Injectable({
  providedIn: 'root',
})
export class ImageFingerprintService {

  async extractFromFile(file: File): Promise<number[]> {
    const img = await this.loadImageFromFile(file);
    return this.extractFingerprint(img);
  }

  async extractFromUrl(url: string): Promise<number[]> {
    const img = await this.loadImageViaFetch(url);
    return this.extractFingerprint(img);
  }

  distance(a: number[], b: number[]): number {
    if (!a?.length || !b?.length) return 1;

    if (a.length === TOTAL_LENGTH && b.length === TOTAL_LENGTH) {
      const hashDist = this.hammingDistance(a, b, 0, DHASH_LENGTH);
      const histDist = this.histogramDistance(a, b, DHASH_LENGTH, TOTAL_LENGTH);
      return hashDist * 0.3 + histDist * 0.7;
    }

    return 1;
  }

  private hammingDistance(a: number[], b: number[], start: number, end: number): number {
    let diff = 0;
    for (let i = start; i < end; i++) {
      if (a[i] !== b[i]) diff++;
    }
    return diff / (end - start);
  }

  private histogramDistance(a: number[], b: number[], start: number, end: number): number {
    let intersection = 0;
    let sumA = 0;
    let sumB = 0;

    for (let i = start; i < end; i++) {
      intersection += Math.min(a[i], b[i]);
      sumA += a[i];
      sumB += b[i];
    }

    const maxSum = Math.max(sumA, sumB);
    if (maxSum === 0) return 1;

    return 1 - (intersection / maxSum);
  }

  private extractFingerprint(img: HTMLImageElement): number[] {
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - size) / 2;
    const sy = (img.naturalHeight - size) / 2;

    const dHash = this.computeDHash(img, sx, sy, size);
    const histogram = this.computeHistogram(img, sx, sy, size);

    return [...dHash, ...histogram];
  }

  private computeDHash(img: HTMLImageElement, sx: number, sy: number, cropSize: number): number[] {
    const canvas = document.createElement('canvas');
    canvas.width = DHASH_SIZE;
    canvas.height = DHASH_SIZE - 1;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, DHASH_SIZE, DHASH_SIZE - 1);

    const data = ctx.getImageData(0, 0, DHASH_SIZE, DHASH_SIZE - 1).data;
    const hash: number[] = [];

    for (let y = 0; y < DHASH_SIZE - 1; y++) {
      for (let x = 0; x < DHASH_SIZE - 1; x++) {
        const leftIdx = (y * DHASH_SIZE + x) * 4;
        const rightIdx = (y * DHASH_SIZE + x + 1) * 4;
        const leftGray = data[leftIdx] * 0.299 + data[leftIdx + 1] * 0.587 + data[leftIdx + 2] * 0.114;
        const rightGray = data[rightIdx] * 0.299 + data[rightIdx + 1] * 0.587 + data[rightIdx + 2] * 0.114;
        hash.push(leftGray > rightGray ? 1 : 0);
      }
    }

    return hash;
  }

  /**
   * Circular-masked RGB histogram: only pixels inside the inscribed circle
   * are counted, reducing background contamination from photo corners.
   */
  private computeHistogram(img: HTMLImageElement, sx: number, sy: number, cropSize: number): number[] {
    const histSize = 64;
    const canvas = document.createElement('canvas');
    canvas.width = histSize;
    canvas.height = histSize;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, histSize, histSize);

    const data = ctx.getImageData(0, 0, histSize, histSize).data;
    const histogram = new Array(HIST_LENGTH).fill(0);
    const binWidth = 256 / HIST_BINS;

    const center = histSize / 2;
    const radius = histSize / 2;
    const r2 = radius * radius;
    let pixelCount = 0;

    for (let y = 0; y < histSize; y++) {
      for (let x = 0; x < histSize; x++) {
        const dx = x - center + 0.5;
        const dy = y - center + 0.5;
        if (dx * dx + dy * dy > r2) continue;

        const i = (y * histSize + x) * 4;
        const rBin = Math.min(HIST_BINS - 1, Math.floor(data[i] / binWidth));
        const gBin = Math.min(HIST_BINS - 1, Math.floor(data[i + 1] / binWidth));
        const bBin = Math.min(HIST_BINS - 1, Math.floor(data[i + 2] / binWidth));
        histogram[rBin * HIST_BINS * HIST_BINS + gBin * HIST_BINS + bBin]++;
        pixelCount++;
      }
    }

    if (pixelCount > 0) {
      for (let i = 0; i < histogram.length; i++) {
        histogram[i] = Math.round((histogram[i] / pixelCount) * 255);
      }
    }

    return histogram;
  }

  private loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async loadImageViaFetch(url: string): Promise<HTMLImageElement> {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
      img.src = objectUrl;
    });
  }
}
