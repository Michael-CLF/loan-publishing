// src/app/components/admin/admin-payments/admin-payments.component.ts

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Firestore, collection, getDocs, query, orderBy, limit, where } from '@angular/fire/firestore';

interface PaymentRecord {
  id: string;
  customerId: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'canceled';
  paymentMethod: string;
  description: string;
  createdAt: Date;
  userRole: 'originator' | 'lender';
  subscriptionId?: string;
  failureReason?: string;
}

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-payments.component.html',
  styleUrls: ['./admin-payments.component.css']
})
export class AdminPaymentsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly firestore = inject(Firestore);

  // State signals
  payments = signal<PaymentRecord[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Filters
  statusFilter = signal<'all' | 'succeeded' | 'failed' | 'pending'>('all');
  roleFilter = signal<'all' | 'originator' | 'lender'>('all');
  searchTerm = signal('');

  // Summary stats
  totalPayments = signal(0);
  successfulPayments = signal(0);
  failedPayments = signal(0);
  totalRevenue = signal(0);

  ngOnInit(): void {
    this.loadPayments();
    
    // Check for query params
    const filter = this.route.snapshot.queryParamMap.get('filter');
    if (filter === 'recent') {
      // Could implement recent filter logic here
    }
  }

  async loadPayments(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      // Since we don't have a payments collection yet, we'll simulate with user data
      // In a real implementation, you'd query your Stripe webhooks collection
      await this.loadMockPaymentData();
      
    } catch (err: any) {
      this.error.set('Failed to load payment records');
      console.error('Error loading payments:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMockPaymentData(): Promise<void> {
    // This simulates payment data - in production you'd have actual Stripe webhook data
    const mockPayments: PaymentRecord[] = [
      {
        id: 'pi_1234567890',
        customerId: 'cus_abc123',
        customerEmail: 'user1@example.com',
        amount: 2999, // $29.99 in cents
        currency: 'usd',
        status: 'succeeded',
        paymentMethod: 'card_visa_4242',
        description: 'Monthly subscription - Originator',
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        userRole: 'originator',
        subscriptionId: 'sub_abc123'
      },
      {
        id: 'pi_0987654321',
        customerId: 'cus_def456',
        customerEmail: 'user2@example.com',
        amount: 29999, // $299.99 in cents
        currency: 'usd',
        status: 'succeeded',
        paymentMethod: 'card_visa_4000',
        description: 'Annual subscription - Lender',
        createdAt: new Date(Date.now() - 172800000), // 2 days ago
        userRole: 'lender',
        subscriptionId: 'sub_def456'
      },
      {
        id: 'pi_1122334455',
        customerId: 'cus_ghi789',
        customerEmail: 'user3@example.com',
        amount: 2999,
        currency: 'usd',
        status: 'failed',
        paymentMethod: 'card_visa_4000',
        description: 'Monthly subscription - Originator',
        createdAt: new Date(Date.now() - 259200000), // 3 days ago
        userRole: 'originator',
        failureReason: 'insufficient_funds'
      }
    ];

    this.payments.set(mockPayments);
    this.calculateStats(mockPayments);
  }

  private calculateStats(payments: PaymentRecord[]): void {
    this.totalPayments.set(payments.length);
    
    const successful = payments.filter(p => p.status === 'succeeded');
    this.successfulPayments.set(successful.length);
    
    const failed = payments.filter(p => p.status === 'failed');
    this.failedPayments.set(failed.length);
    
    const totalRevenue = successful.reduce((sum, payment) => sum + payment.amount, 0);
    this.totalRevenue.set(totalRevenue);
  }

  // Computed filtered payments
  get filteredPayments(): PaymentRecord[] {
    let payments = this.payments();
    
    // Filter by status
    const statusFilter = this.statusFilter();
    if (statusFilter !== 'all') {
      payments = payments.filter(p => p.status === statusFilter);
    }

    // Filter by role
    const roleFilter = this.roleFilter();
    if (roleFilter !== 'all') {
      payments = payments.filter(p => p.userRole === roleFilter);
    }

    // Filter by search term
    const search = this.searchTerm().toLowerCase();
    if (search) {
      payments = payments.filter(p =>
        p.customerEmail.toLowerCase().includes(search) ||
        p.id.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search)
      );
    }

    return payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Utility methods
  formatAmount(amount: number, currency: string = 'usd'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'succeeded': return 'status-success';
      case 'failed': return 'status-failed';
      case 'pending': return 'status-pending';
      case 'canceled': return 'status-canceled';
      default: return 'status-unknown';
    }
  }

  getPaymentMethodDisplay(method: string): string {
    if (method.includes('visa')) return 'Visa ****';
    if (method.includes('mastercard')) return 'Mastercard ****';
    if (method.includes('amex')) return 'Amex ****';
    return 'Card ****';
  }

  // Actions
  viewPaymentDetails(payment: PaymentRecord): void {
    // In a real app, this might open a modal or navigate to details page
    console.log('Viewing payment details:', payment);
    alert(`Payment Details:\n\nID: ${payment.id}\nAmount: ${this.formatAmount(payment.amount)}\nStatus: ${payment.status}\nEmail: ${payment.customerEmail}`);
  }

  refundPayment(payment: PaymentRecord): void {
    if (payment.status !== 'succeeded') {
      alert('Only successful payments can be refunded');
      return;
    }

    if (confirm(`Are you sure you want to refund ${this.formatAmount(payment.amount)} to ${payment.customerEmail}?`)) {
      // In a real app, this would call your refund API
      console.log('Refunding payment:', payment.id);
      alert('Refund functionality would be implemented here');
    }
  }
  trackByPayment(index: number, payment: PaymentRecord): string {
  return payment.id;
}

  exportPayments(): void {
    const csvData = this.filteredPayments.map(payment => ({
      'Payment ID': payment.id,
      'Customer Email': payment.customerEmail,
      'Amount': this.formatAmount(payment.amount),
      'Status': payment.status,
      'Payment Method': this.getPaymentMethodDisplay(payment.paymentMethod),
      'Description': payment.description,
      'User Role': payment.userRole,
      'Date': this.formatDate(payment.createdAt)
    }));

    // Simple CSV export (in production, use a proper CSV library)
    const csv = this.convertToCSV(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }

  // Navigation
  navigateBack(): void {
    this.router.navigate(['/admin']);
  }

  // Filter methods
  clearFilters(): void {
    this.statusFilter.set('all');
    this.roleFilter.set('all');
    this.searchTerm.set('');
  }
}