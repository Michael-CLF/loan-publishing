import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  RoleSelectionModalComponent,
  UserRole,
} from '../role-selection-modal/role-selection-modal.component';
import { UserRoleService } from '../services/user-role.service';
import { AuthService } from '../services/auth.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RoleSelectionModalComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  @ViewChild(RoleSelectionModalComponent)
  roleModal!: RoleSelectionModalComponent;

  private authService = inject(AuthService);

  constructor(
    private router: Router,
    private userRoleService: UserRoleService
  ) {}

  openRoleSelectionModal(): void {
    // Check if user is authenticated
    this.authService
      .getAuthStatus()
      .pipe(take(1))
      .subscribe((isAuthenticated: boolean) => {
        if (isAuthenticated) {
          // User is already authenticated, redirect to dashboard
          this.router.navigate(['/dashboard']);
        } else {
          // User is not authenticated, show role selection modal
          this.roleModal.open();
        }
      });
  }

  handleRoleSelection(role: UserRole): void {
    this.userRoleService.setUserRole(role);

    console.log('Selected role:', role);

    if (role.toString().toUpperCase() === 'LENDER') {
      console.log('Navigating to lender registration');
      this.router.navigate(['/lender-registration']);
    } else {
      console.log('Navigating to user form');
      this.router.navigate(['/user-form']);
    }
  }
}
