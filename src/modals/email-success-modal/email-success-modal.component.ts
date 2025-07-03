import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-email-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-success-modal.component.html',
  styleUrls: ['./email-success-modal.component.css']
})
export class EmailSuccessModalComponent {
  visible = false;

  open(): void {
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }
}
