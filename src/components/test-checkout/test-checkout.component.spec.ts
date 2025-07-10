import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestCheckoutComponent } from './test-checkout.component';

describe('TestCheckoutComponent', () => {
  let component: TestCheckoutComponent;
  let fixture: ComponentFixture<TestCheckoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestCheckoutComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestCheckoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
