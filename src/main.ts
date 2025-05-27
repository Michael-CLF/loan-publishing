import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { provideClientHydration } from '@angular/platform-browser';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { environment } from './environments/environment';

const app = initializeApp(environment.firebase);

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LfWCEwrAAAAABlc_Prf6WpaYX00VC0512hkSWyw'),
  isTokenAutoRefreshEnabled: true,
});

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    provideClientHydration(),
  ],
}).catch((err) => console.error(err));