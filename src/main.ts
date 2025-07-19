import { bootstrapApplication } from '@angular/platform-browser';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAppCheck, ReCaptchaV3Provider, initializeAppCheck } from '@angular/fire/app-check';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { environment } from './environments/environment';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { APP_INITIALIZER } from '@angular/core';
import { AppCheckService } from './services/app-check.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { FirestoreService } from './services/firestore.service';
import { LenderService } from './services/lender.service';
import { LoanService } from './services/loan.service';
import { EmailNotificationService } from './services/email-notification.service';
import { LocationService } from './services/location.service';
import { ModalService } from './services/modal.service';
import { UserService } from './services/user.service';
import { LoanTypeService } from './services/loan-type.service';
import { AuthService } from './services/auth.service';

bootstrapApplication(AppComponent, {
  providers: [
    // ✅ Firebase App initialization
    provideFirebaseApp(() => initializeApp(environment.firebase)),

    // ✅ Firebase Auth
    provideAuth(() => getAuth()),

    // ✅ Firebase Firestore
    provideFirestore(() => getFirestore()),

    // ✅ App Check (commented out but available)
    /* {
      provide: APP_INITIALIZER,
      useFactory: (appCheckService: AppCheckService) => () => appCheckService.initializeAppCheck(),
      deps: [AppCheckService],
      multi: true
    },*/

    // ✅ Router Provider
    provideRouter(routes),

    // ✅ HTTP Client Provider  
    provideHttpClient(),

    // ✅ ALL APPLICATION SERVICES - This fixes the NullInjectorError
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
})
  .catch(err => console.error('Error starting app:', err));