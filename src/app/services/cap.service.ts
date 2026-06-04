import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
} from '@angular/fire/firestore';
import { Cap, CapFilters, createDefaultFilters } from '../models/cap.model';
import { SEED_CAPS } from '../data/seed-data';

const COLLECTION_NAME = 'caps';

@Injectable({
  providedIn: 'root',
})
export class CapService {
  private firestore = inject(Firestore);
  private capsCollection = collection(this.firestore, COLLECTION_NAME);

  private capsSubject = new BehaviorSubject<Cap[]>([]);
  private filtersSubject = new BehaviorSubject<CapFilters>(createDefaultFilters());
  private loadedSubject = new BehaviorSubject<boolean>(false);

  caps$ = this.capsSubject.asObservable();
  filters$ = this.filtersSubject.asObservable();
  loaded$ = this.loadedSubject.asObservable();

  filteredCaps$: Observable<Cap[]> = combineLatest([this.caps$, this.filters$]).pipe(
    map(([caps, filters]) => this.applyFilters(caps, filters))
  );

  stats$: Observable<{ total: number; countries: number; forTrade: number }> = combineLatest([this.caps$, this.filters$]).pipe(
    map(([caps, filters]) => {
      const typed = caps.filter(c => c.type === filters.type);
      return {
        total: typed.length,
        countries: new Set(typed.map((c) => c.country)).size,
        forTrade: typed.filter((c) => c.forTrade).length,
      };
    })
  );

  allTags$: Observable<string[]> = combineLatest([this.caps$, this.filters$]).pipe(
    map(([caps, filters]) => {
      const tagSet = new Set<string>();
      caps.filter(c => c.type === filters.type).forEach((cap) => cap.tags.forEach((tag) => tagSet.add(tag)));
      return Array.from(tagSet).sort();
    })
  );

  allCountries$: Observable<string[]> = combineLatest([this.caps$, this.filters$]).pipe(
    map(([caps, filters]) => {
      const countrySet = new Set<string>();
      caps.filter(c => c.type === filters.type).forEach((cap) => countrySet.add(cap.country));
      return Array.from(countrySet).sort();
    })
  );

  constructor() {
    this.loadCaps();
  }

  private mapDoc(id: string, data: Record<string, unknown>): Cap {
    return {
      id,
      ...(data as Omit<Cap, 'id'>),
      type: (data['type'] as Cap['type']) ?? 'crown',
      forTrade: (data['forTrade'] as boolean) ?? false,
      needsReplacement: (data['needsReplacement'] as boolean) ?? false,
      colors: (data['colors'] as string[]) ?? [],
      cciUrl: (data['cciUrl'] as string) ?? '',
      createdAt: (data['createdAt'] as number) ?? 0,
    };
  }

  private upsertCapLocal(cap: Cap): void {
    const caps = [...this.capsSubject.value];
    const index = caps.findIndex((c) => c.id === cap.id);
    if (index >= 0) {
      caps[index] = cap;
    } else {
      caps.push(cap);
    }
    this.capsSubject.next(caps);
  }

  private removeCapLocal(id: string): void {
    this.capsSubject.next(this.capsSubject.value.filter((c) => c.id !== id));
  }

  private async loadCaps(): Promise<void> {
    try {
      const snapshot = await getDocs(this.capsCollection);
      const caps = snapshot.docs.map((d) => this.mapDoc(d.id, d.data() as Record<string, unknown>));
      this.capsSubject.next(caps);
      this.loadedSubject.next(true);
      this.backfillCreatedAt(caps);
    } catch (err) {
      console.error('Firestore read error:', err);
      this.loadedSubject.next(true);
    }
  }

  private backfillDone = false;

  private async backfillCreatedAt(caps: Cap[]): Promise<void> {
    if (this.backfillDone) return;
    this.backfillDone = true;

    const toFix = caps.filter((c) => !c.createdAt && c.dateAdded);
    for (const cap of toFix) {
      const ts = this.parseDateStr(cap.dateAdded);
      if (ts > 0) {
        try {
          const docRef = doc(this.firestore, COLLECTION_NAME, cap.id);
          await updateDoc(docRef, { createdAt: ts });
        } catch (err) {
          console.warn('Backfill failed for', cap.id, err);
        }
      }
    }
  }

  private formatDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private applyFilters(caps: Cap[], filters: CapFilters): Cap[] {
    const filtered = caps.filter((cap) => {
      if (cap.type !== filters.type) return false;

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          cap.name.toLowerCase().includes(searchLower) ||
          cap.manufacturer.toLowerCase().includes(searchLower) ||
          cap.description?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (filters.country && cap.country !== filters.country) {
        return false;
      }

      if (filters.tag && !cap.tags.includes(filters.tag)) {
        return false;
      }

      if (filters.color && !cap.colors?.includes(filters.color)) {
        return false;
      }

      return !(filters.forTrade !== null && cap.forTrade !== filters.forTrade);
    });

    return this.applySorting(filtered, filters.sort);
  }

  private applySorting(caps: Cap[], sort: string): Cap[] {
    const sorted = [...caps];
    switch (sort) {
      case 'newest':
        return sorted.sort((a, b) => this.getTimestamp(b) - this.getTimestamp(a));
      case 'oldest':
        return sorted.sort((a, b) => this.getTimestamp(a) - this.getTimestamp(b));
      case 'name_asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'country':
        return sorted.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
      default:
        return sorted;
    }
  }

  /** Get precise timestamp: use createdAt if available, fallback to parsing dateAdded */
  private getTimestamp(cap: Cap): number {
    if (cap.createdAt) return cap.createdAt;
    return this.parseDateStr(cap.dateAdded);
  }

  /** Parse DD/MM/YYYY to timestamp (fallback for old records) */
  private parseDateStr(dateStr: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    }
    return 0;
  }

  updateFilters(filters: Partial<CapFilters>): void {
    this.filtersSubject.next({
      ...this.filtersSubject.value,
      ...filters,
    });
  }

  resetFilters(): void {
    this.filtersSubject.next(createDefaultFilters());
  }

  getCapById(id: string): Cap | undefined {
    return this.capsSubject.value.find((cap) => cap.id === id);
  }

  async getCapByIdAsync(id: string): Promise<Cap | undefined> {
    // First try from local cache
    const local = this.capsSubject.value.find((cap) => cap.id === id);
    if (local) return local;

    // Fallback to Firestore
    const docRef = doc(this.firestore, COLLECTION_NAME, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const cap = this.mapDoc(snapshot.id, snapshot.data() as Record<string, unknown>);
      this.upsertCapLocal(cap);
      return cap;
    }
    return undefined;
  }

  async addCap(cap: Omit<Cap, 'id' | 'dateAdded'>): Promise<Cap> {
    const capData = {
      ...cap,
      imageUrl: cap.imageUrl || '',
      description: cap.description || '',
      dateAdded: this.formatDate(new Date()),
      createdAt: Date.now(),
    };
    const docRef = await addDoc(this.capsCollection, capData);
    const newCap = { ...capData, id: docRef.id } as Cap;
    this.upsertCapLocal(newCap);
    return newCap;
  }

  async updateCap(id: string, updates: Partial<Cap>): Promise<void> {
    const docRef = doc(this.firestore, COLLECTION_NAME, id);
    // Remove id and replace undefined values — Firestore doesn't accept undefined
    const { id: _id, ...rest } = updates as any;
    const data: Record<string, any> = {};
    for (const [key, value] of Object.entries(rest)) {
      data[key] = value === undefined ? '' : value;
    }
    await updateDoc(docRef, data);

    const existing = this.getCapById(id);
    if (existing) {
      this.upsertCapLocal({ ...existing, ...updates, id });
    }
  }

  async deleteCap(id: string): Promise<void> {
    const docRef = doc(this.firestore, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    this.removeCapLocal(id);
  }

  async seedData(): Promise<void> {
    for (const cap of SEED_CAPS) {
      const { id, ...data } = cap;
      await addDoc(this.capsCollection, data);
    }
    await this.loadCaps();
  }
}
