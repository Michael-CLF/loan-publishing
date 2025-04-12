import { Component, OnInit, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User } from '@angular/fire/auth';
import { take, switchMap, tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  user: User | null = null;
  userData: any = null; // Match template property name
  loading = true; // Match template property name
  error: string | null = null;

  ngOnInit(): void {
    console.log('Dashboard component initializing...');
    this.verifyAuth();
  }

  private verifyAuth(): void {
    console.log('Verifying authentication status...');

    // First check localStorage for a quick check
    const storedLoginState = localStorage.getItem('isLoggedIn');
    console.log('Stored login state:', storedLoginState);

    if (storedLoginState !== 'true') {
      console.log('Not logged in according to localStorage');
      this.handleNotAuthenticated();
      return;
    }

    // Then verify with Firebase
    this.ngZone.run(() => {
      this.authService.authReady$
        .pipe(
          take(1),
          switchMap(() => this.authService.isLoggedIn$),
          take(1),
          tap((isLoggedIn) => {
            console.log('Firebase auth state:', isLoggedIn);

            if (!isLoggedIn) {
              this.handleNotAuthenticated();
              return;
            }

            // User is authenticated, load user data
            this.loadUserData();
          }),
          catchError((error) => {
            console.error('Error checking auth state:', error);
            this.error = 'Error verifying authentication';
            this.loading = false;
            return of(null);
          })
        )
        .subscribe();
    });
  }

  private handleNotAuthenticated(): void {
    console.log('User not authenticated, redirecting to login');
    this.loading = false;
    this.error = 'You are not authenticated. Please log in.';

    // Clean up any stale login state
    localStorage.removeItem('isLoggedIn');

    // Redirect to login after a brief delay to show the error
    setTimeout(() => {
      this.ngZone.run(() => {
        this.router.navigate(['/login']);
      });
    }, 2000);
  }

  loadUserData(): void {
    console.log('Loading user data...');

    this.ngZone.run(() => {
      this.authService
        .getCurrentUser()
        .pipe(
          take(1),
          switchMap((user) => {
            console.log('Current user:', user?.email || 'No user');

            if (!user) {
              throw new Error('No user found despite being logged in');
            }

            this.user = user;

            // Get user profile from Firestore
            return this.authService.getUserProfile(user.uid).pipe(
              catchError((error) => {
                console.error('Error loading user profile:', error);
                throw new Error('Failed to load user profile');
              })
            );
          }),
          take(1),
          tap((profile) => {
            console.log('User profile loaded:', profile || 'No profile');
            this.userData = profile; // Use userData to match template
            this.loading = false; // Use loading to match template
          }),
          catchError((error) => {
            console.error('Error in loadUserData:', error);
            this.error = error.message || 'Failed to load user data';
            this.loading = false; // Use loading to match template
            return of(null);
          })
        )
        .subscribe();
    });
  }

  logout(): void {
    console.log('Logging out...');
    this.loading = true; // Use loading to match template

    this.ngZone.run(() => {
      this.authService.logout().subscribe({
        next: () => {
          console.log('Logout successful');
          this.router.navigate(['/login']);
        },
        error: (error) => {
          console.error('Error during logout:', error);
          this.error = 'Error during logout';
          this.loading = false; // Use loading to match template
        },
      });
    });
  }
}
