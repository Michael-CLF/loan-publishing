import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavedLenderSuccessModalComponent } from './saved-lender-success-modal.component';

describe('SavedLenderSuccessModalComponent', () => {
  let component: SavedLenderSuccessModalComponent;
  let fixture: ComponentFixture<SavedLenderSuccessModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedLenderSuccessModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SavedLenderSuccessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
