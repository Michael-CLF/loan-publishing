import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

interface StateOption {
  value: string;
  name: string;
}

@Component({
  selector: 'app-lender-footprint',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-footprint.component.html',
  styleUrls: ['./lender-footprint.component.css'],
})
export class LenderFootprintComponent {
  @Input() lenderForm!: FormGroup;
  @Input() states: StateOption[] = [];

  StateOption = [
    { name: 'California', value: 'CA' },
    { name: 'New York', value: 'NY' },
    { name: 'Texas', value: 'TX' },
  ];

  constructor(private fb: FormBuilder) {
    this.lenderForm = this.fb.group({
      CA: [false],
      NY: [false],
      TX: [false],
    });
  }

  onSubmit() {
    const selectedStates = Object.keys(this.lenderForm.value).filter(
      (key) => this.lenderForm.value[key]
    );
    console.log('Selected States:', selectedStates);
  }
}
