import { Component, OnInit, inject, signal } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent implements OnInit {
  private firestore = inject(Firestore);
  private router = inject(Router);

  // Secret admin code
  private readonly adminCode = 'gk#1uykG&R%pH*2L10UW1';

  // Authentication state
  adminAuthenticated = signal(false);
  enteredCode = '';
  codeError = signal(false);

  // Data signals
  lenders = signal<any[]>([]);
  originators = signal<any[]>([]);

  // UI state signals
  loading = signal(false);
  error = signal<string | null>(null);

  // Table columns configuration for consistent display
  tableColumns = [
    { key: 'name', label: 'Name', width: '20%' },
    { key: 'email', label: 'Email', width: '20%' },
    { key: 'company', label: 'Company', width: '20%' },
    { key: 'location', label: 'Location', width: '15%' },
    { key: 'accountNumber', label: 'Account#', width: '10%' },
    { key: 'created', label: 'Created', width: '15%' },
  ];

  ngOnInit() {
    // Check if already authenticated from previous session
    const isAuthenticated = localStorage.getItem('adminAccess') === 'true';
    this.adminAuthenticated.set(isAuthenticated);

    // If already authenticated, load the data
    if (isAuthenticated) {
      this.loadAllUsers();
    }
  }

  verifyAdminCode() {
    if (this.enteredCode === this.adminCode) {
      localStorage.setItem('adminAccess', 'true');
      this.adminAuthenticated.set(true);
      this.codeError.set(false);
      this.loadAllUsers();
    } else {
      this.codeError.set(true);
    }
  }

  async loadAllUsers() {
    try {
      this.loading.set(true);
      this.error.set(null);

      // Load originators from 'users' collection
      const usersQuery = collection(this.firestore, 'users');
      const usersSnapshot = await getDocs(usersQuery);
      const originatorsData = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          accountNumber: doc.id.substring(0, 8).toUpperCase(), // Add account number
          firstName: data['firstName'] || '',
          lastName: data['lastName'] || '',
          email: data['email'] || '',
          company: data['company'] || '',
          city: data['city'] || '',
          state: data['state'] || '',
          createdAt: data['createdAt'],
          role: 'originator',
        };
      });

      // Load lenders from 'lenders' collection
      const lendersQuery = collection(this.firestore, 'lenders');
      const lendersSnapshot = await getDocs(lendersQuery);
      const lendersData = lendersSnapshot.docs.map((doc) => {
        const data = doc.data();
        const contactInfo = data['contactInfo'] || {};

        return {
          id: doc.id,
          accountNumber: doc.id.substring(0, 8).toUpperCase(), // Add account number
          firstName: contactInfo['firstName'] || '',
          lastName: contactInfo['lastName'] || '',
          email: contactInfo['contactEmail'] || '',
          company: data['company'] || contactInfo['company'] || '',
          city: contactInfo['city'] || '',
          state: contactInfo['state'] || '',
          // Ensure createdAt exists - add fallback
          createdAt: data['createdAt'] || new Date(),
          role: 'lender',
        };
      });

      console.log('Originators data:', originatorsData);
      console.log('Lenders data:', lendersData);

      // Update signals
      this.lenders.set(lendersData);
      this.originators.set(originatorsData);
    } catch (err) {
      console.error('Error loading users:', err);
      this.error.set('Failed to load users. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  // Format date for display
  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';

    try {
      // Handle Firestore Timestamp
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString();
      }

      // Handle regular date
      return new Date(timestamp).toLocaleDateString();
    } catch (err) {
      return 'Invalid date';
    }
  }

  // Exit admin mode
  exitAdminMode(): void {
    localStorage.removeItem('adminAccess');
    this.adminAuthenticated.set(false);
    this.router.navigate(['/dashboard']);
  }

  // Get full name from first and last name
  getFullName(user: any): string {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A';
  }

  // Get location from city and state
  getLocation(user: any): string {
    if (user.city && user.state) {
      return `${user.city}, ${user.state}`;
    } else if (user.city) {
      return user.city;
    } else if (user.state) {
      return user.state;
    }
    return 'N/A';
  }
}
