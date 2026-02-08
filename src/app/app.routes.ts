import { Routes } from '@angular/router';
import { CapListComponent } from './components/cap-list/cap-list.component';
import { CapFormComponent } from './components/cap-form/cap-form.component';
import { CapDetailComponent } from './components/cap-detail/cap-detail.component';
import { PasswordPromptComponent } from './components/password-prompt/password-prompt.component';
import { ContactsComponent } from './components/contacts/contacts.component';
import { CountriesComponent } from './components/countries/countries.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: CapListComponent },
  { path: 'countries', component: CountriesComponent },
  { path: 'contacts', component: ContactsComponent },
  { path: 'login', component: PasswordPromptComponent },
  { path: 'add', component: CapFormComponent, canActivate: [authGuard] },
  { path: 'cap/:id', component: CapDetailComponent },
  { path: 'cap/:id/edit', component: CapFormComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
