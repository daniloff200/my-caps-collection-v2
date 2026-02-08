import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil, switchMap } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { Cap } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';

@Component({
  selector: 'app-country-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './country-detail.component.html',
  styleUrls: ['./country-detail.component.scss'],
})
export class CountryDetailComponent implements OnInit, OnDestroy {
  countryName = '';
  caps: Cap[] = [];
  loading = true;

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
        this.caps = caps.filter((c) =>
          this.countryName === 'Unknown'
            ? !c.country || c.country === 'Unknown'
            : c.country === this.countryName
        );
        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
