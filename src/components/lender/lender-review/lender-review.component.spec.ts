import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderReviewComponent } from './lender-review.component';

describe('LenderReviewComponent', () => {
  let component: LenderReviewComponent;
  let fixture: ComponentFixture<LenderReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderReviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
