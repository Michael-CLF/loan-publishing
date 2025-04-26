import {
  Injectable,
  ApplicationRef,
  createComponent,
  EnvironmentInjector,
  inject,
  OnDestroy,
} from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { LoanSuccessModalComponent } from '../components/loan-success-modal/loan-success-modal.component';

@Injectable({
  providedIn: 'root',
})
export class ModalService implements OnDestroy {
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);
  private router = inject(Router);
  private modalComponentRef: any = null;
  private routerSubscription: Subscription;

  constructor() {
    // Subscribe to router navigation events
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => {
        // Close any open modal when navigation starts
        this.closeModal();
      });
  }

  ngOnDestroy(): void {
    // Clean up the subscription when the service is destroyed
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  openLoanSuccessModal(): void {
    // Create the component
    const componentRef = createComponent(LoanSuccessModalComponent, {
      environmentInjector: this.injector,
    });

    // Store reference to component
    this.modalComponentRef = componentRef;

    // Attach to the view
    this.appRef.attachView(componentRef.hostView);

    // Add to the DOM
    const domElement = (componentRef.hostView as any).rootNodes[0];
    document.body.appendChild(domElement);
  }

  closeModal(): void {
    if (this.modalComponentRef) {
      this.appRef.detachView(this.modalComponentRef.hostView);
      this.modalComponentRef.destroy();
      this.modalComponentRef = null;
    }
  }
}
