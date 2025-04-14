import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderContactComponent } from './lender-contact.component';

describe('LenderContactComponent', () => {
  let component: LenderContactComponent;
  let fixture: ComponentFixture<LenderContactComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderContactComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderContactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
