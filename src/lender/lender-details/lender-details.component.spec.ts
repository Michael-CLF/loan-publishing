import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderDetailsComponent } from './lender-details.component';

describe('LenderDetailsComponent', () => {
  let component: LenderDetailsComponent;
  let fixture: ComponentFixture<LenderDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
