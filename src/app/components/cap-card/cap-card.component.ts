import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Cap } from '../../models/cap.model';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';

@Component({
  selector: 'app-cap-card',
  standalone: true,
  imports: [CommonModule, RouterLink, TagBadgeComponent],
  templateUrl: './cap-card.component.html',
  styleUrls: ['./cap-card.component.scss'],
})
export class CapCardComponent {
  @Input({ required: true }) cap!: Cap;
}
