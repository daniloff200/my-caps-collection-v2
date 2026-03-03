import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, skip, takeUntil } from 'rxjs';
import { Cap, CapFilters, SortOption, createDefaultFilters } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { TranslateModule } from '@ngx-translate/core';
import { CapCardComponent } from '../cap-card/cap-card.component';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
import { CountryFlagEmojiPipe } from '../../pipes/country-flag-emoji.pipe';
import { CAP_COLORS } from '../../data/colors';

@Component({
  selector: 'app-cap-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CapCardComponent, TagBadgeComponent, CountryFlagEmojiPipe],
  templateUrl: './cap-list.component.html',
  styleUrls: ['./cap-list.component.scss'],
})
export class CapListComponent implements OnInit, OnDestroy {
  filteredCaps: Cap[] = [];
  allTags: string[] = [];
  allCountries: string[] = [];
  filters: CapFilters = createDefaultFilters();
  showFilters = false;
  loaded = false;
  capColors = CAP_COLORS;

  // Pagination
  readonly pageSize = 25;
  currentPage = 1;

  private destroy$ = new Subject<void>();
  private selfNavigation = false;

  constructor(
    private capService: CapService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.applyUrlParams(this.route.snapshot.queryParams);

    this.route.queryParams
      .pipe(skip(1), takeUntil(this.destroy$))
      .subscribe((params) => {
        if (this.selfNavigation) {
          this.selfNavigation = false;
          return;
        }
        this.applyUrlParams(params);
      });

    this.capService.loaded$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loaded) => (this.loaded = loaded));

    this.capService.filteredCaps$
      .pipe(takeUntil(this.destroy$))
      .subscribe((caps) => {
        this.filteredCaps = caps;
        if (this.loaded && this.currentPage > this.totalPages) {
          this.currentPage = 1;
          this.syncStateToUrl();
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
  }

  private applyUrlParams(params: Record<string, string>): void {
    const defaults = createDefaultFilters();
    this.capService.updateFilters({
      search: params['search'] || defaults.search,
      country: params['country'] || defaults.country,
      tag: params['tag'] || defaults.tag,
      color: params['color'] || defaults.color,
      sort: (params['sort'] as SortOption) || defaults.sort,
      forTrade: params['trade'] === 'true' ? true : params['trade'] === 'false' ? false : defaults.forTrade,
    });

    const page = parseInt(params['page'], 10);
    this.currentPage = page > 0 ? page : 1;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(search: string): void {
    this.capService.updateFilters({ search });
    this.currentPage = 1;
    this.syncStateToUrl();
  }

  onCountryChange(country: string): void {
    this.capService.updateFilters({ country });
    this.currentPage = 1;
    this.syncStateToUrl();
  }

  onTagClick(tag: string): void {
    const newTag = this.filters.tag === tag ? '' : tag;
    this.capService.updateFilters({ tag: newTag });
    this.currentPage = 1;
    this.syncStateToUrl();
  }

  onColorClick(colorId: string): void {
    const newColor = this.filters.color === colorId ? '' : colorId;
    this.capService.updateFilters({ color: newColor });
    this.currentPage = 1;
    this.syncStateToUrl();
  }

  onTradeFilterChange(value: string): void {
    let forTrade: boolean | null = null;
    if (value === 'true') forTrade = true;
    if (value === 'false') forTrade = false;
    this.capService.updateFilters({ forTrade });
    this.currentPage = 1;
    this.syncStateToUrl();
  }

  toggleForTrade(): void {
    const newValue = this.filters.forTrade === true ? null : true;
    this.capService.updateFilters({ forTrade: newValue });
    this.currentPage = 1;
    this.syncStateToUrl();
  }

  resetFilters(): void {
    this.capService.resetFilters();
    this.currentPage = 1;
    this.syncStateToUrl();
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
  }

  // Pagination
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCaps.length / this.pageSize));
  }

  get paginatedCaps(): Cap[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCaps.slice(start, start + this.pageSize);
  }

  get visiblePages(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];

    // Always show first page
    pages.push(1);

    // Pages around current
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }

    // Always show last page
    if (total > 1) {
      pages.push(total);
    }

    // Deduplicate and sort
    return [...new Set(pages)].sort((a, b) => a - b);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.syncStateToUrl();
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
