import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideFunctions, getFunctions } from '@angular/fire/functions';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { provideZoneChangeDetection } from '@angular/core';

// Import all your services
import { AuthService } from '../services/auth.service';
import { AppCheckService } from '../services/app-check.service';
import { NotificationPreferencesService } from '../services/notification-preferences.service';
import { FirestoreService } from '../services/firestore.service';
import { LenderService } from '../services/lender.service';
import { LoanService } from '../services/loan.service';
import { EmailNotificationService } from '../services/email-notification.service';
import { LocationService } from '../services/location.service';
import { ModalService } from '../services/modal.service';
import { UserService } from '../services/user.service';
import { LoanTypeService } from '../services/loan-type.service';

// Email auth initializer function
function initializeEmailAuth(authService: AuthService): () => Promise<void> {
  return async () => {
    try {
      const { firstValueFrom } = await import('rxjs');
      const isEmailLink = await firstValueFrom(authService.isEmailSignInLink());
      
      if (isEmailLink) {
        console.log('🔗 Email sign-in link detected, processing authentication...');
        const storedEmail = authService.getStoredEmail();
        
        if (storedEmail) {
          await firstValueFrom(authService.loginWithEmailLink(storedEmail));
          console.log('✅ Email authentication completed');
        } else {
          console.warn('⚠️ No stored email found for email link sign-in');
        }
      }
    } catch (error) {
      console.error('❌ Error during email auth initialization:', error);
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    // Firebase providers
    provideFirebaseApp(() => {
      console.log('Firebase config:', environment.firebase);
      const app = initializeApp(environment.firebase);
      return app;
    }),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions()),
    provideStorage(() => getStorage()),  // 👈 THIS IS CRITICAL
    
    // Email auth initializer
    {
      provide: APP_INITIALIZER,
      useFactory: initializeEmailAuth,
      deps: [AuthService],
      multi: true
    },
    
    // All services
    AuthService,
    AppCheckService,
    NotificationPreferencesService,
    FirestoreService,
    LenderService,
    LoanService,
    EmailNotificationService,
    LocationService,
    ModalService,
    UserService,
    LoanTypeService,
  ],
};