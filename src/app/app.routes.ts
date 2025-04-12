import { Routes } from '@angular/router';
import { HomeComponent } from '../home/home.component';
import { EmailLoginComponent } from '../email-login/email-login.component';
import { LoanComponent } from '../loan/loan.component';
import { LoansComponent } from '../loans/loans.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { AuthGuard } from '../services/auth.guard';
import { UserFormComponent } from '../user-form/user-form.component';
import { PricingComponent } from '../pricing/pricing.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'user-form', component: UserFormComponent },
  { path: 'login', component: EmailLoginComponent },
  // Add explicit verify route to handle email verification
  { path: 'login/verify', component: EmailLoginComponent },
  { path: 'loan', component: LoanComponent },
  { path: 'loans', component: LoansComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
  },
  { path: 'pricing', component: PricingComponent },
  // Add redirect for any other paths - helps with Firebase dynamic links
  { path: '**', redirectTo: '' },
];
