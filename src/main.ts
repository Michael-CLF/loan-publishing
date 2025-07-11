import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { provideClientHydration } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';


// Bootstrap Angular app
bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    provideClientHydration(),
  ],
}).catch((err) => console.error(err));