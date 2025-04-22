// lender-list.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LenderService, Lender } from '../../services/lender.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-lender-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './lender-list.component.html',
  styleUrl: './lender-list.component.css',
})
export class LenderListComponent implements OnInit, OnDestroy {
  lenders: Lender[] = [];
  loading = true;
  private lendersSubscription: Subscription | null = null;
  private lenderService = inject(LenderService);

  ngOnInit(): void {
    this.loadLenders();
  }

  ngOnDestroy(): void {
    // Clean up subscription to prevent memory leaks
    if (this.lendersSubscription) {
      this.lendersSubscription.unsubscribe();
    }
  }

  loadLenders(): void {
    this.loading = true;
    console.log('Starting to load lenders...');

    // Use getAllLenders instead of getLendersForCurrentUser
    this.lendersSubscription = this.lenderService.getAllLenders().subscribe({
      next: (data) => {
        console.log('Lenders received:', data);
        console.log('Number of lenders:', data.length);

        // Log each lender structure to debug any issues
        data.forEach((lender, index) => {
          console.log(`Lender ${index + 1}:`, lender);
          console.log(`Has contactInfo:`, !!lender.contactInfo);
          console.log(`Has productInfo:`, !!lender.productInfo);
        });

        this.lenders = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading lenders:', error);
        this.loading = false;
      },
      complete: () => {
        console.log('Lenders subscription completed');
      },
    });
  }

  // Simplified for view-only functionality
  deleteLender(id: string | undefined): void {
    if (!id) return;

    if (confirm('Are you sure you want to delete this lender?')) {
      this.lenderService
        .deleteLender(id)
        .then(() => {
          this.lenders = this.lenders.filter((lender) => lender.id !== id);
        })
        .catch((error) => {
          console.error('Error deleting lender', error);
        });
    }
  }
}
