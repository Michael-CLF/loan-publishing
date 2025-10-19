// src/app/components/admin/admin-dashboard/admin-dashboard.component.ts

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly adminCode = 'gk#1uykG&R%pH*2L10UW1';

  // Authentication state
  adminAuthenticated = signal(false);
  enteredCode = '';
  codeError = signal(false);

  // Stats signals
  totalOriginators = signal(0);
  totalLenders = signal(0);
  totalLoans = signal(0);
  activePromotions = signal(0);
  loading = signal(false);

  ngOnInit(): void {
    const isAuthenticated = localStorage.getItem('adminAccess') === 'true';
    this.adminAuthenticated.set(isAuthenticated);
    
    if (isAuthenticated) {
      this.loadDashboardStats();
    }
  }

  verifyAdminCode(): void {
    if (this.enteredCode === this.adminCode) {
      localStorage.setItem('adminAccess', 'true');
      this.adminAuthenticated.set(true);
      this.codeError.set(false);
      this.loadDashboardStats();
    } else {
      this.codeError.set(true);
    }
  }

  async loadDashboardStats(): Promise<void> {
    this.loading.set(true);
    
    try {
      const [originatorsSnap, lendersSnap, loansSnap, promotionsSnap] = await Promise.all([
        getDocs(collection(this.firestore, 'originators')),
        getDocs(collection(this.firestore, 'lenders')),
        getDocs(collection(this.firestore, 'loans')),
        getDocs(collection(this.firestore, 'promotionCodes'))
      ]);

      this.totalOriginators.set(originatorsSnap.size);
      this.totalLenders.set(lendersSnap.size);
      this.totalLoans.set(loansSnap.size);
      
      // Count active promotions
      const activePromos = promotionsSnap.docs.filter(doc => 
        doc.data()['active'] === true
      ).length;
      this.activePromotions.set(activePromos);
      
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      this.loading.set(false);
    }
  }

navigateToOriginators(): void {
  this.router.navigate(['/admin/users']);
}

navigateToLenders(): void {
  this.router.navigate(['/admin/lenders']);
}

navigateToLoans(): void {
  this.router.navigate(['/admin/loans']);
}

  navigateToBilling(): void {
    this.router.navigate(['/admin/billing']);
  }

  navigateToPayments(): void {
    this.router.navigate(['/admin/payments']);
  }

  // Exit admin mode
  exitAdminMode(): void {
    localStorage.removeItem('adminAccess');
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