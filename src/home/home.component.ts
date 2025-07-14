import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  RoleSelectionModalComponent,
  UserRole,
} from '../role-selection-modal/role-selection-modal.component';
import { UserRoleService } from '../services/user-role.service';
import { AuthService } from '../services/auth.service';
import { take } from 'rxjs/operators';
import { ModalService } from 'src/services/modal.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  @ViewChild(RoleSelectionModalComponent)
  roleModal!: RoleSelectionModalComponent;

  private authService = inject(AuthService);

  constructor(
    private router: Router,
    private modalService: ModalService,
    private userRoleService: UserRoleService
  ) {}

  openRoleSelectionModal(): void {
    this.modalService.openRoleSelectionModal();
    this.authService.isLoggedIn$
  .pipe(take(1))
  .subscribe((isAuthenticated: boolean) => {
    if (isAuthenticated) {
      this.router.navigate(['/dashboard']);
    } else {
      this.roleModal.open();
    }
  });

  }
}
