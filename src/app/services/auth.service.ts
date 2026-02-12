import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const SESSION_KEY = 'caps-auth';
// SHA-256 hash of the password, computed at build time
const PASSWORD_HASH = '08c09801e7711a0028c5fd99e3ce758f4550c8197688c321a9b89b44db99c273';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authenticatedSubject = new BehaviorSubject<boolean>(false);
  authenticated$ = this.authenticatedSubject.asObservable();

  readonly hint = 'DD-{BD}-!!';

  constructor() {
    this.authenticatedSubject.next(sessionStorage.getItem(SESSION_KEY) === 'true');
  }

  get isAuthenticated(): boolean {
    return this.authenticatedSubject.value;
  }

  async checkPassword(password: string): Promise<boolean> {
    const hash = await this.hashPassword(password);
    const valid = hash === PASSWORD_HASH;
    if (valid) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      this.authenticatedSubject.next(true);
    }
    return valid;
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    this.authenticatedSubject.next(false);
  }

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
