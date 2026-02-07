import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Cap } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { ToastService } from '../../services/toast.service';
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
  saving = false;

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
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    this.capId = this.route.snapshot.paramMap.get('id');
    if (this.capId) {
      const cap = await this.capService.getCapByIdAsync(this.capId);
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
    setTimeout(() => (this.showTagSuggestions = false), 200);
  }

  async onSubmit(form: NgForm): Promise<void> {
    if (form.invalid) {
      // Mark all fields as touched to show errors
      Object.values(form.controls).forEach((control) => control.markAsTouched());
      this.toastService.error('Please fill in all required fields');
      return;
    }

    this.saving = true;

    const capData = {
      name: this.name.trim(),
      country: this.country,
      manufacturer: this.manufacturer.trim(),
      tags: this.tags,
      imageUrl: this.imageUrl.trim(),
      description: this.description.trim(),
      forTrade: this.forTrade,
    };

    try {
      if (this.isEditMode && this.capId) {
        await this.capService.updateCap(this.capId, capData);
        this.toastService.success('Cap updated successfully!');
        this.router.navigate(['/cap', this.capId]);
      } else {
        const newCap = await this.capService.addCap(capData as Omit<Cap, 'id' | 'dateAdded'>);
        this.toastService.success('Cap added to collection!');
        this.router.navigate(['/cap', newCap.id]);
      }
    } catch (err) {
      console.error('Error saving cap:', err);
      this.toastService.error('Failed to save. Please try again.');
      this.saving = false;
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
