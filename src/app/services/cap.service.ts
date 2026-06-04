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
  setDoc,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  QueryConstraint,
} from '@angular/fire/firestore';
import {
  Cap,
  CapFilters,
  CapType,
  CollectionMeta,
  PaginatedCapsResult,
  SortOption,
  TypeCollectionMeta,
  createDefaultFilters,
} from '../models/cap.model';
import { SEED_CAPS } from '../data/seed-data';

const COLLECTION_NAME = 'caps';
const META_DOC_PATH = 'meta/collection';
const PAGE_SIZE_DEFAULT = 25;

function emptyTypeMeta(): TypeCollectionMeta {
  return { total: 0, forTrade: 0, countries: [], tags: [], countryCounts: {} };
}

function emptyCollectionMeta(): CollectionMeta {
  return { crown: emptyTypeMeta(), pet: emptyTypeMeta(), screw: emptyTypeMeta() };
}

@Injectable({
  providedIn: 'root',
})
export class CapService {
  private firestore = inject(Firestore);
  private capsCollection = collection(this.firestore, COLLECTION_NAME);

  private capsCache = new BehaviorSubject<Cap[]>([]);
  private filtersSubject = new BehaviorSubject<CapFilters>(createDefaultFilters());
  private metaSubject = new BehaviorSubject<CollectionMeta | null>(null);
  private metaReadySubject = new BehaviorSubject<boolean>(false);

  /** Local cache of caps loaded individually (detail page, edits) */
  caps$ = this.capsCache.asObservable();
  filters$ = this.filtersSubject.asObservable();
  meta$ = this.metaSubject.asObservable();
  metaReady$ = this.metaReadySubject.asObservable();

  stats$: Observable<{ total: number; countries: number; forTrade: number }> = combineLatest([
    this.filters$,
    this.meta$,
  ]).pipe(
    map(([filters, meta]) => {
      const t = meta?.[filters.type] ?? emptyTypeMeta();
      return { total: t.total, countries: t.countries.length, forTrade: t.forTrade };
    })
  );

  allTags$: Observable<string[]> = combineLatest([this.filters$, this.meta$]).pipe(
    map(([filters, meta]) => meta?.[filters.type]?.tags ?? [])
  );

  allCountries$: Observable<string[]> = combineLatest([this.filters$, this.meta$]).pipe(
    map(([filters, meta]) => meta?.[filters.type]?.countries ?? [])
  );

  /** Cached caps per type for text search (loaded once per type per session) */
  private searchCache = new Map<CapType, Cap[]>();

  constructor() {
    this.ensureCollectionMeta();
  }

  // ─── Pagination ───────────────────────────────────────────────

  async fetchCapsPage(
    filters: CapFilters,
    page: number,
    pageSize = PAGE_SIZE_DEFAULT
  ): Promise<PaginatedCapsResult> {
    const safePage = Math.max(1, page);

    if (filters.search.trim()) {
      return this.fetchCapsPageWithSearch(filters, safePage, pageSize);
    }

    if (filters.tag && filters.color) {
      return this.fetchCapsPageWithClientFilter(filters, safePage, pageSize, (cap) =>
        cap.colors?.includes(filters.color)
      );
    }

    const filterConstraints = this.buildFilterConstraints(filters);
    const orderConstraints = this.buildOrderConstraints(filters.sort);

    const countSnap = await getCountFromServer(
      query(this.capsCollection, ...filterConstraints)
    );
    const totalCount = countSnap.data().count;

    const totalToFetch = safePage * pageSize;
    const pageConstraints: QueryConstraint[] = [
      ...filterConstraints,
      ...orderConstraints,
      limit(totalToFetch),
    ];

    const snap = await getDocs(query(this.capsCollection, ...pageConstraints));
    const allCaps = snap.docs.map((d) => this.mapDoc(d.id, d.data() as Record<string, unknown>));
    const caps = allCaps.slice((safePage - 1) * pageSize, safePage * pageSize);

    return { caps, totalCount, page: safePage, pageSize };
  }

  async fetchCountryCaps(countryName: string): Promise<Cap[]> {
    if (countryName === 'Unknown') {
      const snap = await getDocs(
        query(this.capsCollection, where('type', '==', 'crown'), orderBy('createdAt', 'desc'))
      );
      return snap.docs
        .map((d) => this.mapDoc(d.id, d.data() as Record<string, unknown>))
        .filter((c) => !c.country || c.country === 'Unknown');
    }

    const snap = await getDocs(
      query(
        this.capsCollection,
        where('type', '==', 'crown'),
        where('country', '==', countryName),
        orderBy('createdAt', 'desc')
      )
    );
    return snap.docs.map((d) => this.mapDoc(d.id, d.data() as Record<string, unknown>));
  }

  getCountryCounts$(type: CapType = 'crown'): Observable<Map<string, number>> {
    return this.meta$.pipe(
      map((meta) => new Map(Object.entries(meta?.[type]?.countryCounts ?? {})))
    );
  }

  // ─── Filters / CRUD ───────────────────────────────────────────

  updateFilters(filters: Partial<CapFilters>): void {
    this.filtersSubject.next({
      ...this.filtersSubject.value,
      ...filters,
    });
  }

  resetFilters(): void {
    this.filtersSubject.next(createDefaultFilters());
    this.searchCache.clear();
  }

  getCurrentFilters(): CapFilters {
    return this.filtersSubject.value;
  }

  getCapById(id: string): Cap | undefined {
    return this.capsCache.value.find((cap) => cap.id === id);
  }

  async getCapByIdAsync(id: string): Promise<Cap | undefined> {
    const local = this.capsCache.value.find((cap) => cap.id === id);
    if (local) return local;

    const docRef = doc(this.firestore, COLLECTION_NAME, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const cap = this.mapDoc(snapshot.id, snapshot.data() as Record<string, unknown>);
      this.upsertCapCache(cap);
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
    this.upsertCapCache(newCap);
    this.searchCache.delete(newCap.type);
    await this.applyMetaChange(newCap, null);
    return newCap;
  }

  async updateCap(id: string, updates: Partial<Cap>): Promise<void> {
    const existing = await this.getCapByIdAsync(id);
    const docRef = doc(this.firestore, COLLECTION_NAME, id);
    const { id: _id, ...rest } = updates as Partial<Cap> & { id?: string };
    const data: Record<string, any> = {};
    for (const [key, value] of Object.entries(rest)) {
      data[key] = value === undefined ? '' : value;
    }
    await updateDoc(docRef, data);

    if (existing) {
      const updated = { ...existing, ...updates, id };
      this.upsertCapCache(updated);
      this.searchCache.delete(updated.type);
      await this.applyMetaChange(updated, existing);
    }
  }

  async deleteCap(id: string): Promise<void> {
    const existing = await this.getCapByIdAsync(id);
    const docRef = doc(this.firestore, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    if (existing) {
      this.removeCapCache(id);
      this.searchCache.delete(existing.type);
      await this.applyMetaRemove(existing);
    }
  }

  async seedData(): Promise<void> {
    for (const cap of SEED_CAPS) {
      const { id, ...data } = cap;
      await addDoc(this.capsCollection, data);
    }
    await this.rebuildCollectionMeta();
  }

  // ─── Private: queries ─────────────────────────────────────────

  private buildFilterConstraints(filters: CapFilters): QueryConstraint[] {
    const constraints: QueryConstraint[] = [where('type', '==', filters.type)];

    if (filters.country) {
      constraints.push(where('country', '==', filters.country));
    }
    if (filters.forTrade !== null) {
      constraints.push(where('forTrade', '==', filters.forTrade));
    }
    if (filters.tag) {
      constraints.push(where('tags', 'array-contains', filters.tag));
    } else if (filters.color) {
      constraints.push(where('colors', 'array-contains', filters.color));
    }

    return constraints;
  }

  private buildOrderConstraints(sort: SortOption): QueryConstraint[] {
    switch (sort) {
      case 'newest':
        return [orderBy('createdAt', 'desc')];
      case 'oldest':
        return [orderBy('createdAt', 'asc')];
      case 'name_asc':
        return [orderBy('name', 'asc')];
      case 'name_desc':
        return [orderBy('name', 'desc')];
      case 'country':
        return [orderBy('country', 'asc'), orderBy('name', 'asc')];
      default:
        return [orderBy('createdAt', 'desc')];
    }
  }

  private async fetchCapsPageWithSearch(
    filters: CapFilters,
    page: number,
    pageSize: number
  ): Promise<PaginatedCapsResult> {
    const all = await this.getSearchCache(filters);
    const filtered = this.applyClientFilters(all, filters);
    const sorted = this.applySorting(filtered, filters.sort);
    const totalCount = sorted.length;
    const start = (page - 1) * pageSize;
    const caps = sorted.slice(start, start + pageSize);
    return { caps, totalCount, page, pageSize };
  }

  private async fetchCapsPageWithClientFilter(
    filters: CapFilters,
    page: number,
    pageSize: number,
    predicate: (cap: Cap) => boolean
  ): Promise<PaginatedCapsResult> {
    const filterConstraints = this.buildFilterConstraints(filters);
    const orderConstraints = this.buildOrderConstraints(filters.sort);
    const snap = await getDocs(
      query(this.capsCollection, ...filterConstraints, ...orderConstraints)
    );
    const filtered = snap.docs
      .map((d) => this.mapDoc(d.id, d.data() as Record<string, unknown>))
      .filter(predicate);
    const sorted = this.applySorting(filtered, filters.sort);
    const totalCount = sorted.length;
    const start = (page - 1) * pageSize;
    const caps = sorted.slice(start, start + pageSize);
    return { caps, totalCount, page, pageSize };
  }

  private async getSearchCache(filters: CapFilters): Promise<Cap[]> {
    if (!this.searchCache.has(filters.type)) {
      const snap = await getDocs(
        query(this.capsCollection, where('type', '==', filters.type), orderBy('createdAt', 'desc'))
      );
      const caps = snap.docs.map((d) => this.mapDoc(d.id, d.data() as Record<string, unknown>));
      this.searchCache.set(filters.type, caps);
      this.backfillCreatedAt(caps);
    }
    return this.searchCache.get(filters.type)!;
  }

  private applyClientFilters(caps: Cap[], filters: CapFilters): Cap[] {
    return caps.filter((cap) => {
      if (filters.country && cap.country !== filters.country) return false;
      if (filters.tag && !cap.tags.includes(filters.tag)) return false;
      if (filters.color && !cap.colors?.includes(filters.color)) return false;
      if (filters.forTrade !== null && cap.forTrade !== filters.forTrade) return false;
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matches =
          cap.name.toLowerCase().includes(q) ||
          cap.manufacturer.toLowerCase().includes(q) ||
          cap.description?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }

  private applySorting(caps: Cap[], sort: SortOption): Cap[] {
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
        return sorted.sort(
          (a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name)
        );
      default:
        return sorted;
    }
  }

  // ─── Private: meta document ───────────────────────────────────

  private async ensureCollectionMeta(): Promise<void> {
    try {
      const metaRef = doc(this.firestore, META_DOC_PATH);
      const snap = await getDoc(metaRef);
      if (snap.exists()) {
        this.metaSubject.next(snap.data() as CollectionMeta);
        this.metaReadySubject.next(true);
        return;
      }
      await this.rebuildCollectionMeta();
    } catch (err) {
      console.error('Failed to load collection meta:', err);
      this.metaReadySubject.next(true);
    }
  }

  private async rebuildCollectionMeta(): Promise<void> {
    const meta = emptyCollectionMeta();

    for (const type of ['crown', 'pet', 'screw'] as CapType[]) {
      const snap = await getDocs(
        query(this.capsCollection, where('type', '==', type), orderBy('createdAt', 'desc'))
      );
      const caps = snap.docs.map((d) => this.mapDoc(d.id, d.data() as Record<string, unknown>));
      meta[type] = this.aggregateTypeMeta(caps);
    }

    await setDoc(doc(this.firestore, META_DOC_PATH), meta);
    this.metaSubject.next(meta);
    this.metaReadySubject.next(true);
  }

  private aggregateTypeMeta(caps: Cap[]): TypeCollectionMeta {
    const typeMeta = emptyTypeMeta();
    typeMeta.total = caps.length;

    for (const cap of caps) {
      if (cap.forTrade) typeMeta.forTrade++;
      const country = cap.country || 'Unknown';
      typeMeta.countryCounts[country] = (typeMeta.countryCounts[country] || 0) + 1;
      if (!typeMeta.countries.includes(country)) typeMeta.countries.push(country);
      for (const tag of cap.tags) {
        if (!typeMeta.tags.includes(tag)) typeMeta.tags.push(tag);
      }
    }

    typeMeta.countries.sort();
    typeMeta.tags.sort();
    return typeMeta;
  }

  private async applyMetaChange(updated: Cap, previous: Cap | null): Promise<void> {
    const meta = { ...(this.metaSubject.value ?? emptyCollectionMeta()) };
    if (previous && previous.type !== updated.type) {
      meta[previous.type] = this.removeCapFromTypeMeta(meta[previous.type], previous);
      meta[updated.type] = this.addCapToTypeMeta(meta[updated.type], updated);
    } else if (previous) {
      meta[updated.type] = this.addCapToTypeMeta(
        this.removeCapFromTypeMeta(meta[updated.type], previous),
        updated
      );
    } else {
      meta[updated.type] = this.addCapToTypeMeta(meta[updated.type], updated);
    }

    await setDoc(doc(this.firestore, META_DOC_PATH), meta);
    this.metaSubject.next(meta);
  }

  private async applyMetaRemove(removed: Cap): Promise<void> {
    const meta = { ...(this.metaSubject.value ?? emptyCollectionMeta()) };
    meta[removed.type] = this.removeCapFromTypeMeta(meta[removed.type], removed);
    await setDoc(doc(this.firestore, META_DOC_PATH), meta);
    this.metaSubject.next(meta);
  }

  private addCapToTypeMeta(typeMeta: TypeCollectionMeta, cap: Cap): TypeCollectionMeta {
    const next = {
      ...typeMeta,
      countries: [...typeMeta.countries],
      tags: [...typeMeta.tags],
      countryCounts: { ...typeMeta.countryCounts },
    };
    next.total++;
    if (cap.forTrade) next.forTrade++;
    const country = cap.country || 'Unknown';
    next.countryCounts[country] = (next.countryCounts[country] || 0) + 1;
    if (!next.countries.includes(country)) next.countries.push(country);
    for (const tag of cap.tags) {
      if (!next.tags.includes(tag)) next.tags.push(tag);
    }
    next.countries.sort();
    next.tags.sort();
    return next;
  }

  private removeCapFromTypeMeta(typeMeta: TypeCollectionMeta, cap: Cap): TypeCollectionMeta {
    const next = {
      ...typeMeta,
      countries: [...typeMeta.countries],
      tags: [...typeMeta.tags],
      countryCounts: { ...typeMeta.countryCounts },
    };
    next.total = Math.max(0, next.total - 1);
    if (cap.forTrade) next.forTrade = Math.max(0, next.forTrade - 1);
    const country = cap.country || 'Unknown';
    if (next.countryCounts[country]) {
      next.countryCounts[country]--;
      if (next.countryCounts[country] <= 0) delete next.countryCounts[country];
    }
    return next;
  }

  // ─── Private: helpers ─────────────────────────────────────────

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

  private upsertCapCache(cap: Cap): void {
    const caps = [...this.capsCache.value];
    const index = caps.findIndex((c) => c.id === cap.id);
    if (index >= 0) caps[index] = cap;
    else caps.push(cap);
    this.capsCache.next(caps);
  }

  private removeCapCache(id: string): void {
    this.capsCache.next(this.capsCache.value.filter((c) => c.id !== id));
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

  private getTimestamp(cap: Cap): number {
    if (cap.createdAt) return cap.createdAt;
    return this.parseDateStr(cap.dateAdded);
  }

  private parseDateStr(dateStr: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    }
    return 0;
  }
}
