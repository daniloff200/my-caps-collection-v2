import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
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

  stats$: Observable<{ total: number; countries: number; forTrade: number }> = this.caps$.pipe(
    map((caps) => ({
      total: caps.length,
      countries: new Set(caps.map((c) => c.country)).size,
      forTrade: caps.filter((c) => c.forTrade).length,
    }))
  );

  allTags$: Observable<string[]> = this.caps$.pipe(
    map((caps) => {
      const tagSet = new Set<string>();
      caps.forEach((cap) => cap.tags.forEach((tag) => tagSet.add(tag)));
      return Array.from(tagSet).sort();
    })
  );

  allCountries$: Observable<string[]> = this.caps$.pipe(
    map((caps) => {
      const countrySet = new Set<string>();
      caps.forEach((cap) => countrySet.add(cap.country));
      return Array.from(countrySet).sort();
    })
  );

  constructor() {
    this.subscribeToFirestore();
  }

  private subscribeToFirestore(): void {
    collectionData(this.capsCollection, { idField: 'id' }).subscribe({
      next: (data) => {
        const caps = data as Cap[];
        this.capsSubject.next(caps);
        this.loadedSubject.next(true);
      },
      error: (err) => {
        console.error('Firestore read error:', err);
        this.loadedSubject.next(true);
      },
    });
  }

  private formatDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private applyFilters(caps: Cap[], filters: CapFilters): Cap[] {
    return caps.filter((cap) => {
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

      if (filters.forTrade !== null && cap.forTrade !== filters.forTrade) {
        return false;
      }

      return true;
    });
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
      return { id: snapshot.id, ...snapshot.data() } as Cap;
    }
    return undefined;
  }

  async addCap(cap: Omit<Cap, 'id' | 'dateAdded'>): Promise<Cap> {
    const capData = {
      ...cap,
      imageUrl: cap.imageUrl || '',
      description: cap.description || '',
      dateAdded: this.formatDate(new Date()),
    };
    const docRef = await addDoc(this.capsCollection, capData);
    return { ...capData, id: docRef.id } as Cap;
  }

  async updateCap(id: string, updates: Partial<Cap>): Promise<void> {
    const docRef = doc(this.firestore, COLLECTION_NAME, id);
    // Remove id from updates if present — Firestore doc ID is not a field
    const { id: _id, ...data } = updates as any;
    await updateDoc(docRef, data);
  }

  async deleteCap(id: string): Promise<void> {
    const docRef = doc(this.firestore, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }

  async seedData(): Promise<void> {
    for (const cap of SEED_CAPS) {
      const { id, ...data } = cap;
      await addDoc(this.capsCollection, data);
    }
  }
}
