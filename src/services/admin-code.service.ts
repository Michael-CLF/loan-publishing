// src/app/services/admin-code.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AdminCodeService {
  // The secure admin code - change this to your preferred secret code
  private readonly adminCode: string = 'gk#1uykG&R%pH*2L10UW1';

  // Track admin status
  private isAdminSubject = new BehaviorSubject<boolean>(false);
  public isAdmin$ = this.isAdminSubject.asObservable();

  constructor() {
    // Check localStorage for existing admin session
    const hasAdminAccess = localStorage.getItem('adminAccess') === 'true';
    this.isAdminSubject.next(hasAdminAccess);
  }

  // Verify the admin code
  verifyAdminCode(code: string): boolean {
    const isValid = code === this.adminCode;

    if (isValid) {
      // Store admin access in session
      localStorage.setItem('adminAccess', 'true');
      this.isAdminSubject.next(true);
    }

    return isValid;
  }

  // Clear admin access
  clearAdminAccess(): void {
    localStorage.removeItem('adminAccess');
    this.isAdminSubject.next(false);
  }

  // Check if user has admin access
  hasAdminAccess(): Observable<boolean> {
    return this.isAdmin$;
  }
}
