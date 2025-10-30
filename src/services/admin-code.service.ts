// src/app/services/admin-code.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminCodeService {
  private isAdminSubject = new BehaviorSubject<boolean>(false);
  public isAdmin$ = this.isAdminSubject.asObservable();

  constructor() {
    // Optional bootstrap check: ask /admin/me on load to restore session
    this.refreshSessionStatus();
  }

  async refreshSessionStatus(): Promise<void> {
    try {
      const resp = await fetch('/admin/me', { method: 'GET', credentials: 'include' });
      this.isAdminSubject.next(resp.ok);
    } catch {
      this.isAdminSubject.next(false);
    }
  }

  // Submit code to server which sets HttpOnly cookie on success
  async verifyAdminCode(code: string): Promise<boolean> {
    const resp = await fetch('/admin/exchange-code', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const ok = resp.ok;
    this.isAdminSubject.next(ok);
    return ok;
  }

 async clearAdminAccess(): Promise<void> {
  try {
    await fetch('/admin/logout', { method: 'GET', credentials: 'include' });
  } finally {
    this.isAdminSubject.next(false);
  }
 }
}