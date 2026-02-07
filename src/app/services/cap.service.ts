import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { Cap, CapFilters, createDefaultFilters } from '../models/cap.model';
import { SEED_CAPS } from '../data/seed-data';

const STORAGE_KEY = 'caps-collection';

@Injectable({
  providedIn: 'root',
})
export class CapService {
  private capsSubject = new BehaviorSubject<Cap[]>([]);
  private filtersSubject = new BehaviorSubject<CapFilters>(createDefaultFilters());

  caps$ = this.capsSubject.asObservable();
  filters$ = this.filtersSubject.asObservable();

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
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const caps = JSON.parse(stored) as Cap[];
        this.capsSubject.next(caps);
      } catch {
        this.seedData();
      }
    } else {
      this.seedData();
    }
  }

  private seedData(): void {
    this.capsSubject.next(SEED_CAPS);
    this.saveToStorage();
  }

  private saveToStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.capsSubject.value));
  }

  private formatDate(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
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

  addCap(cap: Omit<Cap, 'id' | 'dateAdded'>): Cap {
    const newCap: Cap = {
      ...cap,
      id: this.generateId(),
      dateAdded: this.formatDate(new Date()),
    };
    const caps = [...this.capsSubject.value, newCap];
    this.capsSubject.next(caps);
    this.saveToStorage();
    return newCap;
  }

  updateCap(id: string, updates: Partial<Cap>): void {
    const caps = this.capsSubject.value.map((cap) =>
      cap.id === id ? { ...cap, ...updates } : cap
    );
    this.capsSubject.next(caps);
    this.saveToStorage();
  }

  deleteCap(id: string): void {
    const caps = this.capsSubject.value.filter((cap) => cap.id !== id);
    this.capsSubject.next(caps);
    this.saveToStorage();
  }

  resetToSeedData(): void {
    this.capsSubject.next(SEED_CAPS);
    this.saveToStorage();
  }
}
