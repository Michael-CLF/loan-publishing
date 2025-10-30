// src/app/components/admin/admin-dashboard/admin-dashboard.component.ts

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AdminCodeService } from '../../../services/admin-code.service';
import { AdminApiService } from '../../../services/admin-api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit {
  // Services
  private readonly router = inject(Router);
  private readonly adminCodeSvc = inject(AdminCodeService);
  private readonly adminApi = inject(AdminApiService);

  // UI-only gate text (not security)
  private readonly adminCode = 'gk#1uykG&R%pH*2L10UW1';

  // Auth state
  adminAuthenticated = signal(false);
  enteredCode = '';
  codeError = signal(false);

  // Stats
  totalOriginators = signal(0);
  totalLenders = signal(0);
  totalLoans = signal(0);
  activePromotions = signal(0);
  loading = signal(false);

  ngOnInit(): void {
    // Keep UI in sync with server session
    this.adminCodeSvc.isAdmin$
      .pipe(takeUntilDestroyed())
      .subscribe(async ok => {
        this.adminAuthenticated.set(ok);
        if (ok) {
          await this.loadDashboardStats();
        }
      });

    // Check existing HttpOnly cookie session on load
    this.adminCodeSvc.refreshSessionStatus();
  }

  // Submit UI code, server sets HttpOnly cookie if valid
  async verifyAdminCode(): Promise<void> {
    if (!this.enteredCode || this.enteredCode !== this.adminCode) {
      this.codeError.set(true);
      return;
    }
    this.codeError.set(false);

    const ok = await this.adminCodeSvc.verifyAdminCode(this.enteredCode);
    this.adminAuthenticated.set(ok);
    if (ok) {
      await this.loadDashboardStats();
    } else {
      this.codeError.set(true);
    }
  }

  // Fetch stats from admin API (no client Firestore)
  async loadDashboardStats(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.adminApi.getOverview();
      this.totalOriginators.set(data.originators);
      this.totalLenders.set(data.lenders);
      this.totalLoans.set(data.loans);
      this.activePromotions.set(data.activePromotions);
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      this.loading.set(false);
    }
  }

  // Navigation
  navigateToOriginators(): void { this.router.navigate(['/admin/users']); }
  navigateToLenders(): void { this.router.navigate(['/admin/lenders']); }
  navigateToLoans(): void { this.router.navigate(['/admin/loans']); }
  navigateToBilling(): void { this.router.navigate(['/admin/billing']); }
  navigateToPayments(): void { this.router.navigate(['/admin/payments']); }

  // Exit admin UI (session cookie expires server-side by TTL)
  exitAdminMode(): void {
    this.adminCodeSvc.clearAdminAccess();
    this.adminAuthenticated.set(false);
    this.router.navigate(['/dashboard']);
  }

  // Quick actions
  createNewPromotion(): void {
    this.router.navigate(['/admin/billing'], { queryParams: { action: 'create' } });
  }
  viewRecentPayments(): void {
    this.router.navigate(['/admin/payments'], { queryParams: { filter: 'recent' } });
  }
  downloadUserReport(): void {
    this.router.navigate(['/admin/users'], { queryParams: { action: 'export' } });
  }
}
