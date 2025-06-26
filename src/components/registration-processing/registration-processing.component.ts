import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserRegSuccessModalComponent } from '../../modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from '../../modals/lender-reg-success-modal/lender-reg-success-modal.component';

@Component({
  selector: 'app-registration-processing',
  templateUrl: './registration-processing.component.html',
  styleUrls: ['./registration-processing.component.css'],
  standalone: true,
  imports: [CommonModule, UserRegSuccessModalComponent, LenderRegSuccessModalComponent],
})
export class RegistrationProcessingComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ✅ Angular 18 Best Practice: Use signals for reactive state management
  showProcessingSpinner = signal(true);
  showRegistrationSuccessModal = signal(false);
  showLenderRegistrationSuccessModal = signal(false);
  
  private userRole: 'originator' | 'lender' | undefined = undefined;

  ngOnInit(): void {
    console.log('🔄 Registration Processing Component - Starting...');
    
    // ✅ Check if we should be here
    if (!this.shouldShowProcessing()) {
      console.log('❌ No registration success detected - redirecting to dashboard');
      this.router.navigate(['/dashboard']);
      return;
    }

    console.log('✅ Registration success detected - starting processing flow');
    this.startProcessingFlow();
  }

  /**
   * Check if we should show processing (registration success detected)
   */
  private shouldShowProcessing(): boolean {
    return this.authService.getRegistrationSuccess() || 
           localStorage.getItem('showRegistrationModal') === 'true';
  }

  /**
   * Start the complete processing flow
   */
  private startProcessingFlow(): void {
    // Step 1: Show spinner for 1.5 seconds
    console.log('🔄 Step 1: Showing processing spinner...');
    
    // Step 2: Load user data and determine role
    this.loadUserRole();
    
    // Step 3: After 1.5 seconds, hide spinner and show modal
    setTimeout(() => {
      console.log('🔄 Step 3: Hiding spinner, showing modal...');
      this.showProcessingSpinner.set(false);
      this.showModalBasedOnRole();
    }, 1500);
  }

  /**
   * Load user data to determine role for correct modal
   */
  private loadUserRole(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        if (user && user.role) {
          this.userRole = user.role as 'originator' | 'lender';
          console.log('👤 User role determined:', this.userRole);
        } else {
          console.warn('⚠️ Could not determine user role, defaulting to originator');
          this.userRole = 'originator';
        }
      },
      error: (error) => {
        console.error('❌ Error loading user role:', error);
        this.userRole = 'originator'; // Default fallback
      }
    });
  }

  /**
   * Show appropriate modal based on user role
   */
  private showModalBasedOnRole(): void {
    const role = this.userRole;
    console.log('🎭 Showing modal for role:', role);

    if (role === 'originator') {
      console.log('👤 Showing originator registration success modal');
      this.showRegistrationSuccessModal.set(true);
    } else if (role === 'lender') {
      console.log('🏢 Showing lender registration success modal');
      this.showLenderRegistrationSuccessModal.set(true);
    } else {
      console.warn('⚠️ Unknown role, showing default originator modal');
      this.showRegistrationSuccessModal.set(true);
    }

    // Clean up flags after showing modal
    this.clearRegistrationFlags();
  }

  /**
   * Handle originator modal close
   */
  closeRegistrationSuccessModal(): void {
    console.log('✅ Originator modal closed - redirecting to dashboard');
    this.showRegistrationSuccessModal.set(false);
    this.redirectToDashboard();
  }

  /**
   * Handle lender modal close  
   */
  closeLenderRegistrationSuccessModal(): void {
    console.log('✅ Lender modal closed - redirecting to dashboard');
    this.showLenderRegistrationSuccessModal.set(false);
    this.redirectToDashboard();
  }

  /**
   * Clean up all registration success flags
   */
  private clearRegistrationFlags(): void {
    console.log('🧹 Clearing registration success flags');
    this.authService.clearRegistrationSuccess();
    localStorage.removeItem('showRegistrationModal');
    localStorage.removeItem('completeLenderData');
  }

  /**
   * Redirect to dashboard
   */
  private redirectToDashboard(): void {
    console.log('🎯 Redirecting to dashboard...');
    this.router.navigate(['/dashboard']);
  }
}