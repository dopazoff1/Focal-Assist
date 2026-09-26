import { TestBed } from '@angular/core/testing';

import { Kb } from './kb';

describe('Kb', () => {
  let service: Kb;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Kb);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
