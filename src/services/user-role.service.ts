import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type UserRole = 'originator' | 'lender';

@Injectable({
  providedIn: 'root',
})
export class UserRoleService {
  private roleSubject = new BehaviorSubject<UserRole | null>(null);

  constructor() {
    // Check if role exists in localStorage
    const savedRole = localStorage.getItem('userRole') as UserRole | null;
    if (savedRole) {
      this.roleSubject.next(savedRole);
    }
  }

  setUserRole(role: UserRole): void {
    // Save role to localStorage for persistence
    localStorage.setItem('userRole', role);
    this.roleSubject.next(role);
  }

  getUserRole(): Observable<UserRole | null> {
    return this.roleSubject.asObservable();
  }

  getCurrentRole(): UserRole | null {
    return this.roleSubject.value;
  }

  clearUserRole(): void {
    localStorage.removeItem('userRole');
    this.roleSubject.next(null);
  }
}
