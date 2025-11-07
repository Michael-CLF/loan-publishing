import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderStripePaymentComponent } from './lender-stripe-payment.component';

describe('LenderStripePaymentComponent', () => {
  let component: LenderStripePaymentComponent;
  let fixture: ComponentFixture<LenderStripePaymentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderStripePaymentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderStripePaymentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
