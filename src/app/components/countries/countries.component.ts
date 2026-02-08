import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { Cap } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';

interface CountryGroup {
  country: string;
  count: number;
  caps: Cap[];
}

@Component({
  selector: 'app-countries',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './countries.component.html',
  styleUrls: ['./countries.component.scss'],
})
export class CountriesComponent implements OnInit, OnDestroy {
  unknownCaps: Cap[] = [];
  countryGroups: CountryGroup[] = [];
  totalCaps = 0;
  totalCountries = 0;
  expandedCountries = new Set<string>();

  private destroy$ = new Subject<void>();

  constructor(private capService: CapService) {}

  ngOnInit(): void {
    this.capService.caps$.pipe(takeUntil(this.destroy$)).subscribe((caps) => {
      this.buildGroups(caps);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildGroups(caps: Cap[]): void {
    this.totalCaps = caps.length;

    const grouped = new Map<string, Cap[]>();
    for (const cap of caps) {
      const country = cap.country || 'Unknown';
      if (!grouped.has(country)) {
        grouped.set(country, []);
      }
      grouped.get(country)!.push(cap);
    }

    this.unknownCaps = grouped.get('Unknown') || [];
    grouped.delete('Unknown');

    this.countryGroups = Array.from(grouped.entries())
      .map(([country, countryCaps]) => ({
        country,
        count: countryCaps.length,
        caps: countryCaps,
      }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));

    this.totalCountries = this.countryGroups.length;
  }

  toggleCountry(country: string): void {
    if (this.expandedCountries.has(country)) {
      this.expandedCountries.delete(country);
    } else {
      this.expandedCountries.add(country);
    }
  }

  isExpanded(country: string): boolean {
    return this.expandedCountries.has(country);
  }
}
