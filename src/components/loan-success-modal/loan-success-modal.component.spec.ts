import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoanSuccessModalComponent } from './loan-success-modal.component';

describe('LoanSuccessModalComponent', () => {
  let component: LoanSuccessModalComponent;
  let fixture: ComponentFixture<LoanSuccessModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanSuccessModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoanSuccessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
