import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { HeaderComponent } from './components/header/header.component';
import { ToastComponent } from './components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  constructor(private translate: TranslateService) {
    translate.addLangs(['en', 'ru', 'uk', 'pl']);
    translate.setDefaultLang('en');

    const saved = localStorage.getItem('lang');
    if (saved && ['en', 'ru', 'uk', 'pl'].includes(saved)) {
      translate.use(saved);
    } else {
      const browserLang = translate.getBrowserLang() || 'en';
      const match = ['en', 'ru', 'uk', 'pl'].find((l) => browserLang.startsWith(l));
      translate.use(match || 'en');
    }
  }
}
