import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Cap, CapFilters, SortOption, createDefaultFilters } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { TranslateModule } from '@ngx-translate/core';
import { CapCardComponent } from '../cap-card/cap-card.component';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';

@Component({
  selector: 'app-cap-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CapCardComponent, TagBadgeComponent],
  templateUrl: './cap-list.component.html',
  styleUrls: ['./cap-list.component.scss'],
})
export class CapListComponent implements OnInit, OnDestroy {
  filteredCaps: Cap[] = [];
  allTags: string[] = [];
  allCountries: string[] = [];
  filters: CapFilters = createDefaultFilters();
  showFilters = false;

  // Pagination
  readonly pageSize = 25;
  currentPage = 1;

  private destroy$ = new Subject<void>();

  constructor(private capService: CapService) {}

  ngOnInit(): void {
    this.capService.filteredCaps$
      .pipe(takeUntil(this.destroy$))
      .subscribe((caps) => {
        this.filteredCaps = caps;
        // Reset to page 1 if current page is out of range
        if (this.currentPage > this.totalPages) {
          this.currentPage = 1;
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(search: string): void {
    this.capService.updateFilters({ search });
    this.currentPage = 1;
  }

  onCountryChange(country: string): void {
    this.capService.updateFilters({ country });
    this.currentPage = 1;
  }

  onTagClick(tag: string): void {
    const newTag = this.filters.tag === tag ? '' : tag;
    this.capService.updateFilters({ tag: newTag });
    this.currentPage = 1;
  }

  onTradeFilterChange(value: string): void {
    let forTrade: boolean | null = null;
    if (value === 'true') forTrade = true;
    if (value === 'false') forTrade = false;
    this.capService.updateFilters({ forTrade });
    this.currentPage = 1;
  }

  toggleForTrade(): void {
    const newValue = this.filters.forTrade === true ? null : true;
    this.capService.updateFilters({ forTrade: newValue });
    this.currentPage = 1;
  }

  resetFilters(): void {
    this.capService.resetFilters();
    this.currentPage = 1;
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  get hasActiveFilters(): boolean {
    return !!(this.filters.search || this.filters.country || this.filters.tag || this.filters.forTrade !== null);
  }

  get tradeFilterValue(): string {
    if (this.filters.forTrade === true) return 'true';
    if (this.filters.forTrade === false) return 'false';
    return '';
  }

  onSortChange(sort: string): void {
    this.capService.updateFilters({ sort: sort as SortOption });
    this.currentPage = 1;
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  trackByCap(index: number, cap: Cap): string {
    return cap.id;
  }
}
