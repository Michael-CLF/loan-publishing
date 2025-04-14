import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderFormComponent } from './lender-form.component';

describe('LenderFormComponent', () => {
  let component: LenderFormComponent;
  let fixture: ComponentFixture<LenderFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
