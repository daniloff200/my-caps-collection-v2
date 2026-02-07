import { Injectable, inject } from '@angular/core';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from '@angular/fire/storage';
import imageCompression from 'browser-image-compression';

@Injectable({
  providedIn: 'root',
})
export class ImageUploadService {
  private storage = inject(Storage);

  /**
   * Compress image on the client side before uploading.
   * Target: max 600px, JPEG ~80% quality → ~50-80KB per cap photo.
   */
  async compressImage(file: File): Promise<File> {
    const options = {
      maxSizeMB: 0.1,           // max 100KB target
      maxWidthOrHeight: 600,    // resize to max 600px
      useWebWorker: true,
      fileType: 'image/jpeg' as const,
      initialQuality: 0.8,
    };

    try {
      const compressed = await imageCompression(file, options);
      return compressed;
    } catch (err) {
      console.warn('Compression failed, using original:', err);
      return file;
    }
  }

  /**
   * Upload a cap image to Firebase Storage.
   * Returns the public download URL.
   */
  async uploadCapImage(file: File, capId: string): Promise<string> {
    const compressed = await this.compressImage(file);

    const extension = 'jpg';
    const path = `caps/${capId}.${extension}`;
    const storageRef = ref(this.storage, path);

    await uploadBytes(storageRef, compressed, {
      contentType: 'image/jpeg',
      customMetadata: {
        originalName: file.name,
        originalSize: String(file.size),
        compressedSize: String(compressed.size),
      },
    });

    return getDownloadURL(storageRef);
  }

  /**
   * Delete a cap image from Firebase Storage.
   */
  async deleteCapImage(capId: string): Promise<void> {
    const path = `caps/${capId}.jpg`;
    const storageRef = ref(this.storage, path);
    try {
      await deleteObject(storageRef);
    } catch (err: any) {
      // Ignore if file doesn't exist
      if (err?.code !== 'storage/object-not-found') {
        throw err;
      }
    }
  }

  /**
   * Get file size in human-readable format.
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
