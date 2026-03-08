import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil, switchMap } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { Cap, SortOption } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { CountryFlagComponent } from '../country-flag/country-flag.component';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
import { CAP_COLORS } from '../../data/colors';

@Component({
  selector: 'app-country-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, CountryFlagComponent, TagBadgeComponent],
  templateUrl: './country-detail.component.html',
  styleUrls: ['./country-detail.component.scss'],
})
export class CountryDetailComponent implements OnInit, OnDestroy {
  countryName = '';
  allCaps: Cap[] = [];
  loading = true;

  search = '';
  sort: SortOption = 'newest';
  activeTag = '';
  activeColor = '';
  forTrade: boolean | null = null;

  capColors = CAP_COLORS;
  allTags: string[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private capService: CapService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((params) => {
          this.countryName = decodeURIComponent(params.get('country') || '');
          this.loading = true;
          return this.capService.caps$;
        })
      )
      .subscribe((caps) => {
        this.allCaps = caps.filter((c) =>
          c.type === 'crown' && (
            this.countryName === 'Unknown'
              ? !c.country || c.country === 'Unknown'
              : c.country === this.countryName
          )
        );
        const tagSet = new Set<string>();
        this.allCaps.forEach(cap => cap.tags.forEach(t => tagSet.add(t)));
        this.allTags = Array.from(tagSet).sort();
        this.loading = false;
      });
  }

  get filteredCaps(): Cap[] {
    let caps = this.allCaps;

    if (this.search) {
      const q = this.search.toLowerCase();
      caps = caps.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.manufacturer.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      );
    }

    if (this.activeTag) {
      caps = caps.filter(c => c.tags.includes(this.activeTag));
    }

    if (this.activeColor) {
      caps = caps.filter(c => c.colors?.includes(this.activeColor));
    }

    if (this.forTrade !== null) {
      caps = caps.filter(c => c.forTrade === this.forTrade);
    }

    return this.applySorting(caps);
  }

  get hasActiveFilters(): boolean {
    return !!(this.search || this.activeTag || this.activeColor || this.forTrade !== null);
  }

  onSearchChange(value: string): void {
    this.search = value;
  }

  onSortChange(value: string): void {
    this.sort = value as SortOption;
  }

  onTagClick(tag: string): void {
    this.activeTag = this.activeTag === tag ? '' : tag;
  }

  onColorClick(colorId: string): void {
    this.activeColor = this.activeColor === colorId ? '' : colorId;
  }

  toggleForTrade(): void {
    this.forTrade = this.forTrade === true ? null : true;
  }

  resetFilters(): void {
    this.search = '';
    this.activeTag = '';
    this.activeColor = '';
    this.forTrade = null;
    this.sort = 'newest';
  }

  private applySorting(caps: Cap[]): Cap[] {
    const sorted = [...caps];
    switch (this.sort) {
      case 'newest':
        return sorted.sort((a, b) => this.getTimestamp(b) - this.getTimestamp(a));
      case 'oldest':
        return sorted.sort((a, b) => this.getTimestamp(a) - this.getTimestamp(b));
      case 'name_asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name_desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return sorted;
    }
  }

  private getTimestamp(cap: Cap): number {
    if (cap.createdAt) return cap.createdAt;
    if (!cap.dateAdded) return 0;
    const parts = cap.dateAdded.split('/');
    if (parts.length === 3) {
      return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    }
    return 0;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
