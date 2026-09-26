import { ComponentFixture, TestBed } from '@angular/core/testing';


import { MagicAssistance } from './magic-assistance';

describe('MagicAssistance', () => {
  let component: MagicAssistance;
  let fixture: ComponentFixture<MagicAssistance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MagicAssistance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MagicAssistance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
