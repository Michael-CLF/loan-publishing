import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderFootprintComponent } from './lender-footprint.component';

describe('LenderFootprintComponent', () => {
  let component: LenderFootprintComponent;
  let fixture: ComponentFixture<LenderFootprintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderFootprintComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderFootprintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
