import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminLendersComponent } from './admin-lenders.component';

describe('AdminLendersComponent', () => {
  let component: AdminLendersComponent;
  let fixture: ComponentFixture<AdminLendersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLendersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminLendersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
