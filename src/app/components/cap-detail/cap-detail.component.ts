import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Cap } from '../../models/cap.model';
import { CapService } from '../../services/cap.service';
import { AuthService } from '../../services/auth.service';
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

  constructor(
    private capService: CapService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.isAuthenticated = this.authService.isAuthenticated;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cap = this.capService.getCapById(id);
    }
  }

  onDelete(): void {
    if (this.cap && confirm('Are you sure you want to delete this cap?')) {
      this.capService.deleteCap(this.cap.id);
      this.router.navigate(['/']);
    }
  }
}
