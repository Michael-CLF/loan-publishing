import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-reg-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-reg-success-modal.component.html',
  styleUrls: ['./user-reg-success-modal.component.css'],
})
export class UserRegSuccessModalComponent implements OnInit {
  @Output() modalClosed = new EventEmitter<void>();
  isVisible = false;

  constructor(private router: Router) {
    console.log('UserRegSuccessModal created');
  }

  ngOnInit(): void {
    console.log('UserRegSuccessModal initialized');
    // Show modal with slight delay for animation
    setTimeout(() => {
      console.log('Setting modal visible');
      this.isVisible = true;
    }, 100);

    // Auto navigate to dashboard after 3 seconds
    setTimeout(() => {
      console.log('Auto-navigating to dashboard');
      this.goToDashboard();
    }, 4000);
  }

  open(): void {
    console.log('Modal open method called');
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
    console.log('Modal close method called');
    this.isVisible = false;
    setTimeout(() => {
      this.modalClosed.emit();
    }, 300); // Match the transition duration
  }
}
