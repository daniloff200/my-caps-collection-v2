import { Injectable } from '@angular/core';

/**
 * Fingerprint v3:
 * - 64 values: dHash (difference hash) — captures structure/pattern, robust to lighting
 * - 216 values: color histogram (6 bins per RGB channel) — captures color distribution, position-invariant
 * Total: 280 numbers per cap
 */
const DHASH_SIZE = 9; // 9x8 grid → 8x8 = 64 gradient bits
const HIST_BINS = 6;
const HIST_LENGTH = HIST_BINS * HIST_BINS * HIST_BINS; // 216
const DHASH_LENGTH = 64;
const TOTAL_LENGTH = DHASH_LENGTH + HIST_LENGTH; // 280

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
      const histDist = this.chiSquared(a, b, DHASH_LENGTH, TOTAL_LENGTH);
      return hashDist * 0.5 + histDist * 0.5;
    }

    // Incompatible old format
    return 1;
  }

  /** Hamming distance for binary hash values, normalized to 0..1 */
  private hammingDistance(a: number[], b: number[], start: number, end: number): number {
    let diff = 0;
    for (let i = start; i < end; i++) {
      if (a[i] !== b[i]) diff++;
    }
    return diff / (end - start);
  }

  /** Chi-squared distance for histograms, normalized to 0..1 */
  private chiSquared(a: number[], b: number[], start: number, end: number): number {
    let sum = 0;
    for (let i = start; i < end; i++) {
      const denom = a[i] + b[i];
      if (denom > 0) {
        sum += ((a[i] - b[i]) ** 2) / denom;
      }
    }
    return Math.min(sum / 2, 1);
  }

  private extractFingerprint(img: HTMLImageElement): number[] {
    // Center-crop to square
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - size) / 2;
    const sy = (img.naturalHeight - size) / 2;

    // Part 1: dHash — captures structure via horizontal gradients in grayscale
    const dHash = this.computeDHash(img, sx, sy, size);

    // Part 2: color histogram — captures color distribution
    const histogram = this.computeHistogram(img, sx, sy, size);

    return [...dHash, ...histogram];
  }

  private computeDHash(img: HTMLImageElement, sx: number, sy: number, cropSize: number): number[] {
    const canvas = document.createElement('canvas');
    canvas.width = DHASH_SIZE;     // 9 wide
    canvas.height = DHASH_SIZE - 1; // 8 tall
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
        // Grayscale luminance
        const leftGray = data[leftIdx] * 0.299 + data[leftIdx + 1] * 0.587 + data[leftIdx + 2] * 0.114;
        const rightGray = data[rightIdx] * 0.299 + data[rightIdx + 1] * 0.587 + data[rightIdx + 2] * 0.114;
        hash.push(leftGray > rightGray ? 1 : 0);
      }
    }

    return hash;
  }

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
    const pixelCount = histSize * histSize;

    for (let i = 0; i < data.length; i += 4) {
      const rBin = Math.min(HIST_BINS - 1, Math.floor(data[i] / binWidth));
      const gBin = Math.min(HIST_BINS - 1, Math.floor(data[i + 1] / binWidth));
      const bBin = Math.min(HIST_BINS - 1, Math.floor(data[i + 2] / binWidth));
      histogram[rBin * HIST_BINS * HIST_BINS + gBin * HIST_BINS + bBin]++;
    }

    // Normalize to 0-255
    for (let i = 0; i < histogram.length; i++) {
      histogram[i] = Math.round((histogram[i] / pixelCount) * 255);
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
