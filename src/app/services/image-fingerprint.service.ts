import { Injectable } from '@angular/core';

/**
 * Fingerprint structure:
 * - First 768 values: 16x16 normalized RGB pixels (structural match)
 * - Next 64 values: color histogram (4 bins per RGB channel = 64 bins, position-invariant)
 * Total: 832 numbers per cap
 */
const THUMB_SIZE = 32;
const HIST_BINS = 4;
const HIST_LENGTH = HIST_BINS * HIST_BINS * HIST_BINS; // 64
const PIXEL_LENGTH = THUMB_SIZE * THUMB_SIZE * 3;      // 768
const TOTAL_LENGTH = PIXEL_LENGTH + HIST_LENGTH;        // 832

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

  /**
   * Returns distance 0..1. Lower = more similar.
   * Handles both old (192-length) and new (832-length) fingerprints gracefully.
   */
  distance(a: number[], b: number[]): number {
    if (!a?.length || !b?.length) return 1;

    // If both are new format, use combined scoring
    if (a.length === TOTAL_LENGTH && b.length === TOTAL_LENGTH) {
      const pixelDist = this.euclideanNorm(a, b, 0, PIXEL_LENGTH);
      const histDist = this.chiSquared(a, b, PIXEL_LENGTH, TOTAL_LENGTH);
      // Weight: 40% pixel structure, 60% color histogram
      return pixelDist * 0.4 + histDist * 0.6;
    }

    // Fallback: raw euclidean for old/mismatched formats
    if (a.length !== b.length) return 1;
    return this.euclideanNorm(a, b, 0, a.length);
  }

  private euclideanNorm(a: number[], b: number[], start: number, end: number): number {
    let sum = 0;
    const len = end - start;
    for (let i = start; i < end; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    const maxDist = 255 * 255 * len;
    return Math.sqrt(sum) / Math.sqrt(maxDist);
  }

  /** Chi-squared distance for histograms, normalized to 0..1 */
  private chiSquared(a: number[], b: number[], start: number, end: number): number {
    let sum = 0;
    for (let i = start; i < end; i++) {
      const ai = a[i];
      const bi = b[i];
      const denom = ai + bi;
      if (denom > 0) {
        sum += ((ai - bi) * (ai - bi)) / denom;
      }
    }
    // Chi-squared max is 2 when histograms are completely disjoint (normalized)
    return Math.min(sum / 2, 1);
  }

  private extractFingerprint(img: HTMLImageElement): number[] {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    const ctx = canvas.getContext('2d')!;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Center-crop to square
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - size) / 2;
    const sy = (img.naturalHeight - size) / 2;
    ctx.drawImage(img, sx, sy, size, size, 0, 0, THUMB_SIZE, THUMB_SIZE);

    const imageData = ctx.getImageData(0, 0, THUMB_SIZE, THUMB_SIZE);
    const data = imageData.data;

    // Part 1: normalized pixel values
    const pixels: number[] = [];
    let totalR = 0, totalG = 0, totalB = 0;
    const pixelCount = THUMB_SIZE * THUMB_SIZE;

    for (let i = 0; i < data.length; i += 4) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
    }

    const avgR = totalR / pixelCount;
    const avgG = totalG / pixelCount;
    const avgB = totalB / pixelCount;
    // Brightness normalization factor — shift average to 128
    const brightnessTarget = 128;
    const offsetR = brightnessTarget - avgR;
    const offsetG = brightnessTarget - avgG;
    const offsetB = brightnessTarget - avgB;

    for (let i = 0; i < data.length; i += 4) {
      pixels.push(Math.max(0, Math.min(255, Math.round(data[i] + offsetR))));
      pixels.push(Math.max(0, Math.min(255, Math.round(data[i + 1] + offsetG))));
      pixels.push(Math.max(0, Math.min(255, Math.round(data[i + 2] + offsetB))));
    }

    // Part 2: color histogram (from ORIGINAL non-normalized full-res image for accuracy)
    const histCanvas = document.createElement('canvas');
    const histSize = 64;
    histCanvas.width = histSize;
    histCanvas.height = histSize;
    const histCtx = histCanvas.getContext('2d')!;
    histCtx.imageSmoothingEnabled = true;
    histCtx.drawImage(img, sx, sy, size, size, 0, 0, histSize, histSize);
    const histData = histCtx.getImageData(0, 0, histSize, histSize).data;

    const histogram = new Array(HIST_LENGTH).fill(0);
    const histPixels = histSize * histSize;

    for (let i = 0; i < histData.length; i += 4) {
      const rBin = Math.min(HIST_BINS - 1, Math.floor(histData[i] / (256 / HIST_BINS)));
      const gBin = Math.min(HIST_BINS - 1, Math.floor(histData[i + 1] / (256 / HIST_BINS)));
      const bBin = Math.min(HIST_BINS - 1, Math.floor(histData[i + 2] / (256 / HIST_BINS)));
      histogram[rBin * HIST_BINS * HIST_BINS + gBin * HIST_BINS + bBin]++;
    }

    // Normalize histogram to 0-255 range for consistent storage
    for (let i = 0; i < histogram.length; i++) {
      histogram[i] = Math.round((histogram[i] / histPixels) * 255);
    }

    return [...pixels, ...histogram];
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
