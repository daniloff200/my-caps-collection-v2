import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tag-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tag-badge.component.html',
  styleUrls: ['./tag-badge.component.scss'],
})
export class TagBadgeComponent {
  @Input() tag = '';
  @Input() clickable = false;
  @Input() removable = false;
  @Input() active = false;
  @Output() tagClick = new EventEmitter<string>();
  @Output() tagRemove = new EventEmitter<string>();
}
