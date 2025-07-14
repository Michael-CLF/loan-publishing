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

bootstrapApplication(AppComponent, {
  providers: [
    // Firebase App initialization
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    
    // Firebase Auth
    provideAuth(() => getAuth()),
    
    // Firebase Firestore
    provideFirestore(() => getFirestore()),
    
    // App Check with reCAPTCHA v3
    provideAppCheck(() => 
      initializeAppCheck(undefined, {
        provider: new ReCaptchaV3Provider(environment.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      })
    ),
    
    // ✅ SINGLE ROUTER PROVIDER
    provideRouter(routes),
    
    // ✅ SINGLE HTTP CLIENT PROVIDER  
    provideHttpClient(),
  ],
})
.catch(err => console.error('Error starting app:', err));