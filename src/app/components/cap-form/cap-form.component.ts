import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Cap } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { COUNTRIES } from '../../data/countries';
import { COMMON_TAGS } from '../../data/tags';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';

@Component({
  selector: 'app-cap-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TagBadgeComponent],
  templateUrl: './cap-form.component.html',
  styleUrls: ['./cap-form.component.scss'],
})
export class CapFormComponent implements OnInit {
  isEditMode = false;
  capId: string | null = null;

  name = '';
  country = '';
  manufacturer = '';
  tags: string[] = [];
  imageUrl = '';
  description = '';
  forTrade = false;

  customTag = '';
  countries = COUNTRIES;
  commonTags = COMMON_TAGS;
  showTagSuggestions = false;

  constructor(
    private capService: CapService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.capId = this.route.snapshot.paramMap.get('id');
    if (this.capId) {
      const cap = this.capService.getCapById(this.capId);
      if (cap) {
        this.isEditMode = true;
        this.name = cap.name;
        this.country = cap.country;
        this.manufacturer = cap.manufacturer;
        this.tags = [...cap.tags];
        this.imageUrl = cap.imageUrl || '';
        this.description = cap.description || '';
        this.forTrade = cap.forTrade;
      }
    }
  }

  get filteredSuggestions(): string[] {
    if (!this.customTag) return this.commonTags.filter((t) => !this.tags.includes(t));
    const search = this.customTag.toLowerCase();
    return this.commonTags.filter(
      (t) => t.toLowerCase().includes(search) && !this.tags.includes(t)
    );
  }

  addTag(tag: string): void {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !this.tags.includes(trimmed)) {
      this.tags.push(trimmed);
    }
    this.customTag = '';
    this.showTagSuggestions = false;
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  onTagInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.customTag.trim()) {
        this.addTag(this.customTag);
      }
    }
  }

  onTagInputFocus(): void {
    this.showTagSuggestions = true;
  }

  onTagInputBlur(): void {
    // Delay to allow click on suggestion
    setTimeout(() => (this.showTagSuggestions = false), 200);
  }

  onSubmit(): void {
    if (!this.name.trim() || !this.country || !this.manufacturer.trim()) {
      return;
    }

    const capData = {
      name: this.name.trim(),
      country: this.country,
      manufacturer: this.manufacturer.trim(),
      tags: this.tags,
      imageUrl: this.imageUrl.trim() || undefined,
      description: this.description.trim() || undefined,
      forTrade: this.forTrade,
    };

    if (this.isEditMode && this.capId) {
      this.capService.updateCap(this.capId, capData);
      this.router.navigate(['/cap', this.capId]);
    } else {
      const newCap = this.capService.addCap(capData as Omit<Cap, 'id' | 'dateAdded'>);
      this.router.navigate(['/cap', newCap.id]);
    }
  }

  cancel(): void {
    if (this.isEditMode && this.capId) {
      this.router.navigate(['/cap', this.capId]);
    } else {
      this.router.navigate(['/']);
    }
  }
}
