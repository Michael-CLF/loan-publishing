import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { environment } from '../environments/environment';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
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
    setTimeout(() => {
      console.log('Firebase Auth initialized:', !!this.auth);

      // Check auth state
      this.authService.isLoggedIn$.subscribe((isLoggedIn) => {
        console.log('Auth state:', isLoggedIn);
        console.log(
          'localStorage isLoggedIn:',
          localStorage.getItem('isLoggedIn')
        );
      });
    }, 500);
  }
}
