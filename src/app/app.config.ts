import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { provideZoneChangeDetection } from '@angular/core';
import { ApplicationConfig } from '@angular/core';
import { provideFunctions, getFunctions } from '@angular/fire/functions';


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
import { adminAuthInterceptorProvider } from '../app/interceptors/auth.interceptor';


// --- Inside appConfig ---
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    adminAuthInterceptorProvider,
  

    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    // Firebase providers
    provideFirebaseApp(() => {
      console.log('Firebase config:', environment.firebase);
      const app = initializeApp(environment.firebase);
      return app;
    }),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    provideFunctions(() => getFunctions()),
    
        
    // All services
    AuthService,
    AppCheckService,
    FirestoreService,
    ModalService,
    UserService,
  ],
};