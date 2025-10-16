// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error('Error starting app:', err));


function signalIdle() {
  // Custom event other scripts can listen for
  window.dispatchEvent(new Event('app:idle'));
}

// Prefer the browser’s idle callback; fall back to a small timeout if unavailable
if ('requestIdleCallback' in window) {
  (window as any).requestIdleCallback(signalIdle);
} else {
  setTimeout(signalIdle, 2000);
}
