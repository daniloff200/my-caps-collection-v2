import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Cap, CapFilters, createDefaultFilters } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { CapCardComponent } from '../cap-card/cap-card.component';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';

@Component({
  selector: 'app-cap-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CapCardComponent, TagBadgeComponent],
  templateUrl: './cap-list.component.html',
  styleUrls: ['./cap-list.component.scss'],
})
export class CapListComponent implements OnInit, OnDestroy {
  filteredCaps: Cap[] = [];
  allTags: string[] = [];
  allCountries: string[] = [];
  filters: CapFilters = createDefaultFilters();
  showFilters = false;

  private destroy$ = new Subject<void>();

  constructor(private capService: CapService) {}

  ngOnInit(): void {
    this.capService.filteredCaps$
      .pipe(takeUntil(this.destroy$))
      .subscribe((caps) => (this.filteredCaps = caps));

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
  }

  onCountryChange(country: string): void {
    this.capService.updateFilters({ country });
  }

  onTagClick(tag: string): void {
    const newTag = this.filters.tag === tag ? '' : tag;
    this.capService.updateFilters({ tag: newTag });
  }

  onTradeFilterChange(value: string): void {
    let forTrade: boolean | null = null;
    if (value === 'true') forTrade = true;
    if (value === 'false') forTrade = false;
    this.capService.updateFilters({ forTrade });
  }

  toggleForTrade(): void {
    const newValue = this.filters.forTrade === true ? null : true;
    this.capService.updateFilters({ forTrade: newValue });
  }

  resetFilters(): void {
    this.capService.resetFilters();
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

  trackByCap(index: number, cap: Cap): string {
    return cap.id;
  }
}
