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
    private userRoleService: UserRoleService
  ) {}

  // ✅ NEW: Check auth status immediately when component loads
  ngOnInit(): void {
    console.log('🏠 Home Component - Checking auth status for auto-redirect');
    
    // Wait for auth to be ready, then check if user is authenticated
    this.authService.authReady$
      .pipe(
        filter((ready) => ready),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Now check if user is logged in
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

  // ✅ Angular 18 Best Practice: Proper cleanup
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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