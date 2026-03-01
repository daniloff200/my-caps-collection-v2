import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Cap } from '../../models/cap.model';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
import { CountryFlagComponent } from '../country-flag/country-flag.component';
import { CAP_COLORS } from '../../data/colors';

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

  getColorHex(colorId: string): string {
    return CAP_COLORS.find(c => c.id === colorId)?.hex || '#718096';
  }

  getColorBorder(colorId: string): string {
    const c = CAP_COLORS.find(col => col.id === colorId);
    return c?.border || c?.hex || '#718096';
  }
}
