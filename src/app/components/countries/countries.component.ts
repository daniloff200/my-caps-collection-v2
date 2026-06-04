import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { CapService } from '../../services/cap.service';
import { CollectionMeta } from '../../models/cap.model';
import { WorldMapComponent } from '../world-map/world-map.component';
import { CountryFlagComponent } from '../country-flag/country-flag.component';

interface CountryGroup {
  country: string;
  count: number;
}

@Component({
  selector: 'app-countries',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, WorldMapComponent, CountryFlagComponent],
  templateUrl: './countries.component.html',
  styleUrls: ['./countries.component.scss'],
})
export class CountriesComponent implements OnInit, OnDestroy {
  unknownCount = 0;
  countryGroups: CountryGroup[] = [];
  totalCaps = 0;
  totalCountries = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private capService: CapService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.capService.meta$
      .pipe(takeUntil(this.destroy$))
      .subscribe((meta) => {
        if (meta) this.buildGroups(meta);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildGroups(meta: CollectionMeta): void {
    const crown = meta.crown;
    this.totalCaps = crown.total;
    this.unknownCount = crown.countryCounts['Unknown'] || 0;

    this.countryGroups = Object.entries(crown.countryCounts)
      .filter(([country]) => country !== 'Unknown')
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));

    this.totalCountries = this.countryGroups.length;
  }

  onMapCountryClick(countryName: string): void {
    this.router.navigate(['/countries', countryName]);
  }

  navigateToCountry(countryName: string): void {
    this.router.navigate(['/countries', countryName]).then(() => {
      window.scrollTo({ top: 0 });
    });
  }
}
