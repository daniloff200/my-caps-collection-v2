import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, skip, takeUntil } from 'rxjs';
import { Cap, CapFilters, CapType, SortOption, createDefaultFilters } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { TranslateModule } from '@ngx-translate/core';
import { CapCardComponent } from '../cap-card/cap-card.component';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
import { CountryFlagEmojiPipe } from '../../pipes/country-flag-emoji.pipe';
import { CAP_COLORS } from '../../data/colors';

@Component({
  selector: 'app-cap-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, CapCardComponent, TagBadgeComponent, CountryFlagEmojiPipe],
  templateUrl: './cap-list.component.html',
  styleUrls: ['./cap-list.component.scss'],
})
export class CapListComponent implements OnInit, OnDestroy {
  pageCaps: Cap[] = [];
  totalCount = 0;
  allTags: string[] = [];
  allCountries: string[] = [];
  filters: CapFilters = createDefaultFilters();
  searchInput = '';
  showFilters = false;
  loaded = false;
  loadingPage = false;
  capColors = CAP_COLORS;
  capType: CapType = 'crown';

  readonly pageSize = 25;
  currentPage = 1;

  private destroy$ = new Subject<void>();
  private searchDebounced$ = new Subject<string>();
  private selfNavigation = false;
  private reloadRequest$ = new Subject<void>();

  constructor(
    private capService: CapService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  get addLink(): string {
    if (this.capType === 'pet') return '/pet/add';
    if (this.capType === 'screw') return '/screw/add';
    return '/add';
  }

  get titleKey(): string {
    if (this.capType === 'pet') return 'LIST.TITLE_PET';
    if (this.capType === 'screw') return 'LIST.TITLE_SCREW';
    return '';
  }

  ngOnInit(): void {
    this.capType = (this.route.snapshot.data['capType'] as CapType) || 'crown';
    this.capService.updateFilters({ type: this.capType });
    this.applyUrlParams(this.route.snapshot.queryParams);

    this.route.queryParams
      .pipe(skip(1), takeUntil(this.destroy$))
      .subscribe((params) => {
        if (this.selfNavigation) {
          this.selfNavigation = false;
          return;
        }
        this.applyUrlParams(params);
        this.reloadRequest$.next();
      });

    this.capService.metaReady$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ready) => {
        if (ready && !this.loaded) {
          this.reloadRequest$.next();
        }
      });

    this.capService.allTags$
      .pipe(takeUntil(this.destroy$))
      .subscribe((tags) => (this.allTags = tags));

    this.capService.allCountries$
      .pipe(takeUntil(this.destroy$))
      .subscribe((countries) => (this.allCountries = countries));

    this.capService.filters$
      .pipe(takeUntil(this.destroy$))
      .subscribe((filters) => (this.filters = { ...filters }));

    this.searchDebounced$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.capService.updateFilters({ search });
        this.currentPage = 1;
        this.syncStateToUrl();
        this.reloadRequest$.next();
      });

    this.reloadRequest$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadPage());

    this.reloadRequest$.next();
  }

  private applyUrlParams(params: Record<string, string>): void {
    const defaults = createDefaultFilters();
    const search = params['search'] || defaults.search;
    this.searchInput = search;
    this.capService.updateFilters({
      type: this.capType,
      search,
      country: params['country'] || defaults.country,
      tag: params['tag'] || defaults.tag,
      color: params['color'] || defaults.color,
      sort: (params['sort'] as SortOption) || defaults.sort,
      forTrade: params['trade'] === 'true' ? true : params['trade'] === 'false' ? false : defaults.forTrade,
    });

    const page = parseInt(params['page'], 10);
    this.currentPage = page > 0 ? page : 1;
  }

  private async loadPage(): Promise<void> {
    this.loadingPage = true;
    try {
      const result = await this.capService.fetchCapsPage(
        this.capService.getCurrentFilters(),
        this.currentPage,
        this.pageSize
      );
      this.pageCaps = result.caps;
      this.totalCount = result.totalCount;

      if (this.currentPage > 1 && this.pageCaps.length === 0 && this.totalCount > 0) {
        this.currentPage = 1;
        this.syncStateToUrl();
        return this.loadPage();
      }

      this.loaded = true;
    } catch (err) {
      console.error('Failed to load caps page:', err);
      this.pageCaps = [];
      this.totalCount = 0;
      this.loaded = true;
    } finally {
      this.loadingPage = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(search: string): void {
    this.searchInput = search;
    this.searchDebounced$.next(search);
  }

  onCountryChange(country: string): void {
    this.capService.updateFilters({ country });
    this.currentPage = 1;
    this.syncStateToUrl();
    this.reloadRequest$.next();
  }

  onTagClick(tag: string): void {
    const newTag = this.filters.tag === tag ? '' : tag;
    this.capService.updateFilters({ tag: newTag });
    this.currentPage = 1;
    this.syncStateToUrl();
    this.reloadRequest$.next();
  }

  onColorClick(colorId: string): void {
    const newColor = this.filters.color === colorId ? '' : colorId;
    this.capService.updateFilters({ color: newColor });
    this.currentPage = 1;
    this.syncStateToUrl();
    this.reloadRequest$.next();
  }

  onTradeFilterChange(value: string): void {
    let forTrade: boolean | null = null;
    if (value === 'true') forTrade = true;
    if (value === 'false') forTrade = false;
    this.capService.updateFilters({ forTrade });
    this.currentPage = 1;
    this.syncStateToUrl();
    this.reloadRequest$.next();
  }

  toggleForTrade(): void {
    const newValue = this.filters.forTrade === true ? null : true;
    this.capService.updateFilters({ forTrade: newValue });
    this.currentPage = 1;
    this.syncStateToUrl();
    this.reloadRequest$.next();
  }

  resetFilters(): void {
    this.searchInput = '';
    this.capService.resetFilters();
    this.capService.updateFilters({ type: this.capType });
    this.currentPage = 1;
    this.syncStateToUrl();
    this.reloadRequest$.next();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  get hasActiveFilters(): boolean {
    return !!(this.filters.search || this.filters.country || this.filters.tag || this.filters.color || this.filters.forTrade !== null);
  }

  get tradeFilterValue(): string {
    if (this.filters.forTrade === true) return 'true';
    if (this.filters.forTrade === false) return 'false';
    return '';
  }

  onSortChange(sort: string): void {
    this.capService.updateFilters({ sort: sort as SortOption });
    this.currentPage = 1;
    this.syncStateToUrl();
    this.reloadRequest$.next();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  get visiblePages(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];

    pages.push(1);

    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }

    if (total > 1) {
      pages.push(total);
    }

    return [...new Set(pages)].sort((a, b) => a - b);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.syncStateToUrl();
      this.reloadRequest$.next();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private syncStateToUrl(): void {
    this.selfNavigation = true;
    const f = this.filters;
    const queryParams: Record<string, string | null> = {
      search: f.search || null,
      country: f.country || null,
      tag: f.tag || null,
      color: f.color || null,
      sort: f.sort !== 'newest' ? f.sort : null,
      trade: f.forTrade === true ? 'true' : f.forTrade === false ? 'false' : null,
      page: this.currentPage > 1 ? String(this.currentPage) : null,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  trackByCap(index: number, cap: Cap): string {
    return cap.id;
  }
}
