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

 ngOnInit(): void {}
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

 private handleMagicLink(): void {
  const storedEmail = this.authService.getStoredEmail();
  console.log('Processing magic link for email:', storedEmail || 'Not found - will wait for auth completion');

  if (!storedEmail) {
    console.log('⏳ No stored email, waiting for Firebase auth to complete...');
    
    // Give Firebase time to process the magic link authentication
    setTimeout(() => {
      this.authService.isLoggedIn$.pipe(take(1)).subscribe(isAuthenticated => {
        if (isAuthenticated) {
          console.log('✅ Authentication completed via magic link, redirecting to dashboard');
          localStorage.setItem('isLoggedIn', 'true');
          this.router.navigate(['/dashboard']);
        } else {
          console.log('❌ Authentication failed, redirecting to login');
          this.router.navigate(['/login'], { 
            queryParams: { magicLink: 'true' }
          });
        }
      });
    }, 2000); // Wait 2 seconds for Firebase to process
    
    return;
  }

  // Original flow for when email is stored
  this.authService.loginWithEmailLink(storedEmail).subscribe({
    next: (userCredential) => {
      console.log('✅ Magic link authentication successful:', userCredential.user?.email);
      localStorage.setItem('isLoggedIn', 'true');
      this.router.navigate(['/dashboard']);
    },
    error: (error) => {
      console.error('❌ Magic link authentication failed:', error);
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