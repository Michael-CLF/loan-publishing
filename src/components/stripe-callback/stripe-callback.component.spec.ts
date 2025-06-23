import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StripeCallbackComponent } from './stripe-callback.component';

describe('StripeCallbackComponent', () => {
  let component: StripeCallbackComponent;
  let fixture: ComponentFixture<StripeCallbackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StripeCallbackComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StripeCallbackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
