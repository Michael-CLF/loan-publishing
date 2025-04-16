import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderProductComponent } from './lender-product.component';

describe('LenderProductComponent', () => {
  let component: LenderProductComponent;
  let fixture: ComponentFixture<LenderProductComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderProductComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderProductComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
