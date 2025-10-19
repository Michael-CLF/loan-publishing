import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefinanceSavingsComponent } from './refinance-savings.component';

describe('RefinanceSavingsComponent', () => {
  let component: RefinanceSavingsComponent;
  let fixture: ComponentFixture<RefinanceSavingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefinanceSavingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RefinanceSavingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
