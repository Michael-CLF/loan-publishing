import { Component, ViewChild, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  RoleSelectionModalComponent,
  UserRole,
} from '../role-selection-modal/role-selection-modal.component';
import { UserRoleService } from '../services/user-role.service';
import { ModalService } from 'src/services/modal.service';
import { FirebaseVideoComponent } from '../components/firebase-video/firebase-video.component';
import { isPlatformBrowser } from '@angular/common';
import { AnalyticsService } from '../services/analytics.service'

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FirebaseVideoComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  @ViewChild(RoleSelectionModalComponent)
  roleModal!: RoleSelectionModalComponent;
  


  constructor(
    private router: Router,
    private modalService: ModalService,
    private userRoleService: UserRoleService,
    private route: ActivatedRoute,   
    private analytics: AnalyticsService,
     @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit(): void {}
  onGainAccessClick(): void {
  // Track the button click
  this.analytics.trackButtonClick('Gain Access', 'home-hero');
  
  // Log for debugging
  console.log('🎯 Gain Access button clicked and tracked');
  
}

openRoleSelectionModal(): void {
  // Track the button click
  this.analytics.trackButtonClick('Gain Access', 'home-hero');
  
  // Open the modal via service
  this.modalService.openRoleSelectionModal();
  
  // Open the actual modal component
  if (this.roleModal) {
    this.roleModal.open();
  }
}
}