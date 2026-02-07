import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-password-prompt',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './password-prompt.component.html',
  styleUrls: ['./password-prompt.component.scss'],
})
export class PasswordPromptComponent {
  password = '';
  error = '';
  loading = false;
  hint: string;

  private returnUrl: string;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.hint = this.authService.hint;
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/add';
  }

  async onSubmit(): Promise<void> {
    if (!this.password.trim()) {
      this.error = 'Please enter a password';
      return;
    }

    this.loading = true;
    this.error = '';

    const valid = await this.authService.checkPassword(this.password);

    this.loading = false;

    if (valid) {
      this.router.navigateByUrl(this.returnUrl);
    } else {
      this.error = 'Wrong password. Try again!';
      this.password = '';
    }
  }
}
