import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Cap } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { TagBadgeComponent } from '../tag-badge/tag-badge.component';

@Component({
  selector: 'app-cap-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TagBadgeComponent],
  templateUrl: './cap-detail.component.html',
  styleUrls: ['./cap-detail.component.scss'],
})
export class CapDetailComponent implements OnInit {
  cap: Cap | undefined;
  isAuthenticated = false;
  loading = true;

  constructor(
    private capService: CapService,
    private authService: AuthService,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.isAuthenticated = this.authService.isAuthenticated;
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cap = await this.capService.getCapByIdAsync(id);
    }
    this.loading = false;
  }

  async onDelete(): Promise<void> {
    if (this.cap && confirm('Are you sure you want to delete this cap?')) {
      try {
        await this.capService.deleteCap(this.cap.id);
        this.toastService.success('Cap deleted');
        this.router.navigate(['/']);
      } catch (err) {
        this.toastService.error('Failed to delete cap');
      }
    }
  }
}
