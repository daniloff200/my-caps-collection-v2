import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Cap } from '../../models/cap.model';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
import { CountryFlagComponent } from '../country-flag/country-flag.component';

@Component({
  selector: 'app-cap-card',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, TagBadgeComponent, CountryFlagComponent],
  templateUrl: './cap-card.component.html',
  styleUrls: ['./cap-card.component.scss'],
})
export class CapCardComponent {
  @Input({ required: true }) cap!: Cap;

  get cciId(): string {
    if (!this.cap?.cciUrl) return '';
    const match = this.cap.cciUrl.match(/\/(\d+)\/?$/);
    return match ? match[1] : '';
  }
}
