import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-email-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-success-modal.component.html',
  styleUrls: ['./email-success-modal.component.css']
})

export class EmailSuccessModalComponent {
  @Output() modalClosed = new EventEmitter<void>();

  isOpen = false;

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
    this.modalClosed.emit();
  }
}