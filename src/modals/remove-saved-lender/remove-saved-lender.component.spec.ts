import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RemoveSavedLenderComponent } from './remove-saved-lender.component';

describe('RemoveSavedLenderComponent', () => {
  let component: RemoveSavedLenderComponent;
  let fixture: ComponentFixture<RemoveSavedLenderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoveSavedLenderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RemoveSavedLenderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
