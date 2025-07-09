import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import {
  provideAnimations,
  provideNoopAnimations,
} from '@angular/platform-browser/animations';

// Firebase imports
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

// Import environment config
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(routes),
    provideAnimations(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    
    // Auth - production only
    provideAuth(() => getAuth()),
    
    // Firestore - production only
    provideFirestore(() => getFirestore()),
    
    // Functions - production only
    provideFunctions(() => getFunctions(undefined, 'us-central1')),
    
    provideStorage(() => getStorage()),
    provideNoopAnimations(),
  ],
};