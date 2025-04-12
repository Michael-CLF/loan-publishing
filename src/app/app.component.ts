import { Component, OnInit, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { environment } from '../environments/environment';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Auth, User } from '@angular/fire/auth';
import { filter, take, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    HeaderComponent,
    FooterComponent,
    NavbarComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'loanpost';
  // Force injection of Auth service
  private auth = inject(Auth);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  ngOnInit() {
    // Debug which environment file is being loaded
    console.log(
      'Environment check:',
      environment.production ? 'Production' : 'Development',
      'API Key exists:',
      !!environment.firebase.apiKey,
      'API Key length:',
      environment.firebase.apiKey ? environment.firebase.apiKey.length : 0
    );

    // Force initialization and ensure Firebase Auth is loaded
    console.log('Firebase Auth initialized:', !!this.auth);

    // Handle email verification links first
    this.handleEmailVerification();

    // Check auth state
    this.authService.isLoggedIn$.subscribe((isLoggedIn) => {
      console.log('Auth state:', isLoggedIn);
      console.log(
        'localStorage isLoggedIn:',
        localStorage.getItem('isLoggedIn')
      );
    });
  }

  private handleEmailVerification(): void {
    console.log('Checking for email verification link...');

    // Check if the current URL is a sign-in link
    this.authService
      .isEmailSignInLink()
      .pipe(
        take(1),
        tap((isSignInLink) => {
          console.log('Is email sign-in link?', isSignInLink);

          if (isSignInLink) {
            console.log(
              'Email sign-in link detected, handling authentication flow'
            );

            // Get stored email
            const storedEmail = this.authService.getStoredEmail();
            console.log('Stored email found?', !!storedEmail);

            if (storedEmail) {
              // Attempt to sign in with the email link
              this.authService.signInWithEmailLink(storedEmail).subscribe({
                next: (user: User | null) => {
                  if (user) {
                    console.log(
                      'Sign-in with email link successful:',
                      user.email
                    );

                    // Set login state explicitly
                    localStorage.setItem('isLoggedIn', 'true');

                    // Navigate to dashboard
                    this.ngZone.run(() => {
                      console.log(
                        'Navigating to dashboard after successful auth'
                      );
                      const redirectUrl =
                        localStorage.getItem('redirectUrl') || '/dashboard';
                      this.router.navigate([redirectUrl]);
                      localStorage.removeItem('redirectUrl');
                    });
                  } else {
                    console.log(
                      'Sign-in with email link failed, redirecting to login'
                    );
                    this.router.navigate(['/login']);
                  }
                },
                error: (error: Error) => {
                  console.error('Error signing in with email link:', error);
                  this.router.navigate(['/login']);
                },
              });
            } else {
              console.log(
                'No stored email found, redirecting to login for manual entry'
              );
              // Redirect to login page to handle the verification there
              this.router.navigate(['/login']);
            }
          } else if (window.location.pathname === '/') {
            // Check if user is authenticated and at home page, redirect to dashboard if needed
            this.authService.authReady$
              .pipe(
                filter((ready) => ready),
                take(1),
                switchMap(() => this.authService.isLoggedIn$),
                take(1)
              )
              .subscribe((isLoggedIn) => {
                if (isLoggedIn) {
                  console.log(
                    'User is authenticated at home page, redirecting to dashboard'
                  );
                  this.ngZone.run(() => {
                    this.router.navigate(['/dashboard']);
                  });
                }
              });
          }
        })
      )
      .subscribe();
  }
}
