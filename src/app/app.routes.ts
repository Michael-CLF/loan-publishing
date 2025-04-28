import { Routes } from '@angular/router';
import { HomeComponent } from '../home/home.component';
import { EmailLoginComponent } from '../email-login/email-login.component';
import { LoanComponent } from '../loan/loan.component';
import { LoansComponent } from '../loans/loans.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { AuthGuard } from '../services/auth.guard';
import { UserFormComponent } from '../user-form/user-form.component';
import { PricingComponent } from '../pricing/pricing.component';
import { TermsComponent } from 'src/terms/terms.component';
import { LenderFormComponent } from 'src/lender-form/lender-form.component';
import { LenderContactComponent } from 'src/lender/lender-contact/lender-contact.component';
import { LenderProductComponent } from 'src/lender/lender-product/lender-product.component';
import { LenderFootprintComponent } from 'src/lender/lender-footprint/lender-footprint.component';
import { LenderRegistrationComponent } from 'src/lender/lender-registration/lender-registration.component';
import { LenderReviewComponent } from 'src/lender/lender-review/lender-review.component';
import { LoanDetailsComponent } from 'src/loan-details/loan-details.component';
import { LenderDetailsComponent } from 'src/lender/lender-details/lender-details.component';
import { LenderListComponent } from 'src/lender/lender-list/lender-list.component';
import { EditAccountComponent } from 'src/edit-account/edit-account.component';
import { EditLoanComponent } from 'src/edit-loan/edit-loan.component';

export const routes: Routes = [
  {
    path: 'account/edit',
    component: EditAccountComponent,
    canActivate: [AuthGuard],
  },
  { path: '', component: HomeComponent },
  { path: 'lender-form', component: LenderFormComponent },
  { path: 'lender-details/:id', component: LenderDetailsComponent },
  {
    path: 'lender-list',
    component: LenderListComponent,
    canActivate: [AuthGuard],
  },
  { path: 'user-form', component: UserFormComponent },
  { path: 'login', component: EmailLoginComponent },
  // Add explicit verify route to handle email verification
  { path: 'login/verify', component: EmailLoginComponent },

  { path: 'lender-registration', component: LenderRegistrationComponent },
  { path: 'lender-contact', component: LenderContactComponent },
  { path: 'lender-product', component: LenderProductComponent },
  { path: 'lender-review', component: LenderReviewComponent },
  { path: 'lender-footprint', component: LenderFootprintComponent },
  { path: 'loan', component: LoanComponent, canActivate: [AuthGuard] },
  { path: 'loans', component: LoansComponent, canActivate: [AuthGuard] },
  {
    path: 'loan-details',
    component: LoanDetailsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'loans/:id',
    component: LoanDetailsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'loans/:id/edit',
    component: EditLoanComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
  },
  { path: 'pricing', component: PricingComponent },
  { path: 'terms', component: TermsComponent },
];
