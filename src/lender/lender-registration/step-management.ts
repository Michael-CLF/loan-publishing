// src/app/lender-registration/step-management.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Step {
  id: number;
  name: string;
  completed: boolean;
  valid: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class StepManagementService {
private steps: Step[] = [
  { id: 0, name: 'Contact Information', completed: false, valid: false },
  { id: 1, name: 'Product Details', completed: false, valid: false },
  { id: 2, name: 'Lending Footprint', completed: false, valid: false },
  { id: 3, name: 'Review', completed: false, valid: false },
  { id: 4, name: 'Payment', completed: false, valid: false },
];


  private currentStepSubject = new BehaviorSubject<number>(0);
  currentStep$ = this.currentStepSubject.asObservable();

  private stepsSubject = new BehaviorSubject<Step[]>(this.steps);
  steps$ = this.stepsSubject.asObservable();

  getCurrentStep(): number {
    return this.currentStepSubject.value;
  }

  getSteps(): Step[] {
    return [...this.steps];
  }

  setCurrentStep(stepIndex: number): void {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.currentStepSubject.next(stepIndex);
    }
  }

  moveToNextStep(): boolean {
    const currentStep = this.getCurrentStep();
    if (currentStep < this.steps.length - 1) {
      // Mark current step as completed
      this.updateStepStatus(currentStep, true, true);

      // Move to next step
      this.setCurrentStep(currentStep + 1);
      return true;
    }
    return false;
  }

  moveToPreviousStep(): boolean {
    const currentStep = this.getCurrentStep();
    if (currentStep > 0) {
      this.setCurrentStep(currentStep - 1);
      return true;
    }
    return false;
  }

  updateStepStatus(
    stepIndex: number,
    completed: boolean,
    valid: boolean
  ): void {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.steps[stepIndex].completed = completed;
      this.steps[stepIndex].valid = valid;
      this.stepsSubject.next([...this.steps]);
    }
  }

  canProceedToStep(stepIndex: number): boolean {
    // Can always go back to previous steps
    if (stepIndex <= this.getCurrentStep()) {
      return true;
    }

    // Can only proceed to next step if all previous steps are valid
    for (let i = 0; i < stepIndex; i++) {
      if (!this.steps[i].valid) {
        return false;
      }
    }

    return true;
  }

  resetSteps(): void {
    this.steps = this.steps.map((step) => ({
      ...step,
      completed: false,
      valid: false,
    }));
    this.stepsSubject.next([...this.steps]);
    this.setCurrentStep(0);
  }
}
