import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EventEmitter, Output } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-lender-reg-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lender-reg-success-modal.component.html',
  styleUrl: './lender-reg-success-modal.component.css',
})
export class LenderRegSuccessModalComponent implements OnDestroy {
 private router = inject(Router);
  
  // ✅ Simple state management (matching originator modal)
  isVisible = false;

  @Output() modalClosed = new EventEmitter<void>();

  constructor() {
    console.log('LenderRegSuccessModal created');
  }

  ngOnInit(): void {
    console.log('LenderRegSuccessModal initialized');
    // Show modal with slight delay for animation
    setTimeout(() => {
      console.log('Setting lender modal visible');
      this.isVisible = true;
    }, 100);

    // Auto navigate to dashboard after 4 seconds (matching originator modal)
    setTimeout(() => {
      console.log('Auto-navigating to dashboard');
      this.goToDashboard();
    }, 4000);
  }

  open(): void {
    console.log('Lender modal open method called');
    this.isVisible = true;
  }

  goToDashboard(): void {
    console.log('goToDashboard called');
    this.close();
    // Emit event that will be caught by the modal service
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 300);
  }

  close(): void {
    console.log('Lender modal close method called');
    this.isVisible = false;
    setTimeout(() => {
      this.modalClosed.emit();
    }, 300); // Match the transition duration
  }

  ngOnDestroy(): void {
    console.log('LenderRegSuccessModal destroyed');
  }
}