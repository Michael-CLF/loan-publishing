import { Component, ViewChild, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  RoleSelectionModalComponent,
  UserRole,
} from '../role-selection-modal/role-selection-modal.component';
import { UserRoleService } from '../services/user-role.service';
import { ModalService } from 'src/services/modal.service';
import { FirebaseVideoComponent } from '../components/firebase-video/firebase-video.component';
import { isPlatformBrowser } from '@angular/common';
import { AnalyticsService } from '../services/analytics.service'

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FirebaseVideoComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  @ViewChild(RoleSelectionModalComponent)
  roleModal!: RoleSelectionModalComponent;
  

  // Don't inject AuthService here - we'll load it on demand

  constructor(
    private router: Router,
    private modalService: ModalService,
    private userRoleService: UserRoleService,
    private route: ActivatedRoute,   
    private analytics: AnalyticsService,
     @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit(): void {}
  onGainAccessClick(): void {
  // Track the button click
  this.analytics.trackButtonClick('Gain Access', 'home-hero');
  
  // Log for debugging
  console.log('🎯 Gain Access button clicked and tracked');
  
  // Add any other logic you want when the button is clicked
  // For example, navigation or opening a modal
}

  async openRoleSelectionModal(): Promise<void> {
    this.modalService.openRoleSelectionModal();
    this.analytics.trackButtonClick('Gain Access', 'home-hero');

    // Lazy-load AuthService only when button is clicked
    try {
      const { AuthService } = await import('../services/auth.service');
      const { inject } = await import('@angular/core');
      
      // Get AuthService instance
      const authService = inject(AuthService);
      
      // Check auth status
      authService.isLoggedIn$.pipe(
        (await import('rxjs/operators')).take(1)
      ).subscribe((isAuthenticated: boolean) => {
        if (isAuthenticated) {
          console.log('✅ User authenticated via modal check, redirecting to dashboard');
          this.router.navigate(['/dashboard']);
        } else {
          console.log('👤 User not authenticated, opening role selection modal');
          if (this.roleModal) {
            this.roleModal.open();
          }
        }
      });
    } catch (error) {
      console.error('Error loading auth service:', error);
      // Still open modal even if auth check fails
      if (this.roleModal) {
        this.roleModal.open();
      }
    }
  }
}