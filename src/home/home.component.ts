import { Component, ViewChild, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  RoleSelectionModalComponent,
  UserRole,
} from '../role-selection-modal/role-selection-modal.component';
import { UserRoleService } from '../services/user-role.service';
import { AuthService } from '../services/auth.service';
import { filter, take, takeUntil } from 'rxjs/operators';
import { ModalService } from 'src/services/modal.service';
import { Subject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild(RoleSelectionModalComponent)
  roleModal!: RoleSelectionModalComponent;

  private authService = inject(AuthService);
  
  // ✅ Angular 18 Best Practice: Proper cleanup
  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private modalService: ModalService,
    private userRoleService: UserRoleService,
    private route: ActivatedRoute
  ) {}

 ngOnInit(): void {
  console.log('🏠 Home Component - Checking for magic link or auth status');
  
  // Check if this is a magic link first
  this.authService.isEmailSignInLink().subscribe({
    next: (isSignInLink) => {
      if (isSignInLink) {
        console.log('🔗 Magic link detected, processing authentication...');
        this.handleMagicLink();
      } else {
        console.log('📋 Regular homepage visit, checking auth status...');
        this.checkAuthAndRedirect();
      }
    },
    error: (error) => {
      console.error('❌ Error checking magic link:', error);
      this.checkAuthAndRedirect(); // Fallback to normal auth check
    }
  });
}
  // ✅ Angular 18 Best Practice: Proper cleanup
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private handleMagicLink(): void {
  const storedEmail = this.authService.getStoredEmail();
  console.log('Processing magic link for email:', storedEmail || 'Not found');

  if (!storedEmail) {
    console.error('❌ No stored email for magic link');
    // Redirect to login page for manual email entry
    this.router.navigate(['/login']);
    return;
  }

  this.authService.loginWithEmailLink(storedEmail).subscribe({
    next: (userCredential) => {
      console.log('✅ Magic link authentication successful:', userCredential.user?.email);
      localStorage.setItem('isLoggedIn', 'true');
      this.router.navigate(['/dashboard']);
    },
    error: (error) => {
      console.error('❌ Magic link authentication failed:', error);
      // Redirect to login with error handling
      this.router.navigate(['/login'], { 
        queryParams: { error: 'magic-link-failed' } 
      });
    }
  });
}

private checkAuthAndRedirect(): void {
  this.authService.authReady$
    .pipe(
      filter((ready) => ready),
      take(1),
      takeUntil(this.destroy$)
    )
    .subscribe(() => {
      this.authService.isLoggedIn$
        .pipe(
          take(1),
          takeUntil(this.destroy$)
        )
        .subscribe((isAuthenticated: boolean) => {
          if (isAuthenticated) {
            console.log('✅ User is authenticated, redirecting to dashboard');
            this.router.navigate(['/dashboard']);
          } else {
            console.log('👤 User not authenticated, staying on homepage');
          }
        });
    });
}

  openRoleSelectionModal(): void {
    this.modalService.openRoleSelectionModal();
    
    // ✅ Double-check auth status when modal is opened (keeps existing functionality)
    this.authService.isLoggedIn$
      .pipe(
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe((isAuthenticated: boolean) => {
        if (isAuthenticated) {
          console.log('✅ User authenticated via modal check, redirecting to dashboard');
          this.router.navigate(['/dashboard']);
        } else {
          console.log('👤 User not authenticated, opening role selection modal');
          this.roleModal.open();
        }
      });
  }
}