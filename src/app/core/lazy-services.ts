import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LazyServicesLoader {
  private servicesLoaded = false;

  async loadNonCriticalServices(): Promise<void> {
    if (this.servicesLoaded) return;
    
    // These will be loaded on-demand
    const promises = [
      import('../../services/lender.service'),
      import('../../services/loan.service'),
      import('../../services/email-notification.service'),
      import('../../services/location.service')
    ];
    
    await Promise.all(promises);
    this.servicesLoaded = true;
  }
}