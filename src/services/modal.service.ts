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
import { RoleSelectionModalComponent } from '../role-selection-modal/role-selection-modal.component';
import { UserRole } from '../role-selection-modal/role-selection-modal.component';
import { LenderRegSuccessModalComponent } from '../modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { UserRegSuccessModalComponent } from '../modals/user-reg-success-modal/user-reg-success-modal.component';
import { DeleteAccountModalComponent } from '../modals/delete-account-modal/delete-account-modal.component';
import { RemoveSavedLoanModalComponent } from '../modals/remove-saved-loan/remove-saved-loan.component';

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

  openUserRegSuccessModal(): void {
    // Create the component
    const componentRef = createComponent(UserRegSuccessModalComponent, {
      environmentInjector: this.injector,
    });

    // Store reference to component
    this.modalComponentRef = componentRef;

    // Attach to the view
    this.appRef.attachView(componentRef.hostView);

    // Add to the DOM
    const domElement = (componentRef.hostView as any).rootNodes[0];
    document.body.appendChild(domElement);

    // Call open() method on the instance
    componentRef.instance.open();

    // Listen for modal closed event
    componentRef.instance.modalClosed.subscribe(() => {
      this.closeModal();
    });

    // Auto-redirect to dashboard after 3 seconds
    setTimeout(() => {
      this.closeModal();
      this.router.navigate(['/dashboard']);
    }, 3000);
  }

  openLenderRegistrationSuccessModal(): void {
    // Create the component
    const componentRef = createComponent(LenderRegSuccessModalComponent, {
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

  openRoleSelectionModal(): void {
    console.log('ModalService - Beginning to create modal');

    if (this.modalComponentRef) {
      console.log('ModalService - Closing existing modal');
      this.closeModal();
    }

    try {
      console.log('ModalService - Creating component');
      const componentRef = createComponent(RoleSelectionModalComponent, {
        environmentInjector: this.injector,
      });

      console.log('ModalService - Component created');
      this.modalComponentRef = componentRef;

      // CRITICAL: Call open() method on the instance
      componentRef.instance.open();
      console.log('ModalService - Called open() on modal instance');

      this.appRef.attachView(componentRef.hostView);
      console.log('ModalService - View attached');

      const domElement = (componentRef.hostView as any).rootNodes[0];
      document.body.appendChild(domElement);
      console.log('ModalService - Added to DOM');

      // Listen for role selection
      componentRef.instance.roleSelected.subscribe((role: UserRole) => {
        if (role === 'originator') {
          this.router.navigate(['/user-form']);
        } else if (role === 'lender') {
          this.router.navigate(['/lender-registration']);
        }

        this.closeModal();
      });
      // Also listen if modal manually closed
      componentRef.instance.modalClosed.subscribe(() => {
        console.log('ModalService - Modal closed by user');
        this.closeModal();
      });
    } catch (error) {
      console.error('ModalService - Error creating modal:', error);
    }
  }

  openDeleteAccountModal(userType: 'lender' | 'originator'): Promise<boolean> {
    // Create the component
    const componentRef = createComponent(DeleteAccountModalComponent, {
      environmentInjector: this.injector,
    });

    // Store reference to component
    this.modalComponentRef = componentRef;

    // Set input properties
    componentRef.instance.userType = userType;
    componentRef.instance.isOpen = true;

    // Attach to the view
    this.appRef.attachView(componentRef.hostView);

    // Add to the DOM
    const domElement = (componentRef.hostView as any).rootNodes[0];
    document.body.appendChild(domElement);

    // Return a promise that resolves when the user makes a choice
    return new Promise<boolean>((resolve) => {
      // Handle confirm action
      componentRef.instance.confirm.subscribe(() => {
        this.closeModal();
        resolve(true);
      });

      // Handle cancel action
      componentRef.instance.cancel.subscribe(() => {
        this.closeModal();
        resolve(false);
      });
    });
  }

  openRemoveSavedLoanModal(loanData: any): Promise<boolean> {
    // Create the component
    const componentRef = createComponent(RemoveSavedLoanModalComponent, {
      environmentInjector: this.injector,
    });

    // Store reference to component
    this.modalComponentRef = componentRef;

    // Set input properties
    componentRef.instance.isOpen = true;
    componentRef.instance.loanData = loanData;

    // Attach to the view
    this.appRef.attachView(componentRef.hostView);

    // Add to the DOM
    const domElement = (componentRef.hostView as any).rootNodes[0];
    document.body.appendChild(domElement);

    // Return a promise that resolves when the user makes a choice
    return new Promise<boolean>((resolve) => {
      // Handle confirm action
      componentRef.instance.confirm.subscribe(() => {
        this.closeModal();
        resolve(true);
      });

      // Handle cancel action
      componentRef.instance.cancel.subscribe(() => {
        this.closeModal();
        resolve(false);
      });
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
