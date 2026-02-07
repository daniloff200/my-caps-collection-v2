import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CapService } from '../../services/cap.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  stats$ = this.capService.stats$;
  isAuthenticated$ = this.authService.authenticated$;

  constructor(
    private capService: CapService,
    private authService: AuthService
  ) {}

  onLogout(): void {
    this.authService.logout();
  }
}
