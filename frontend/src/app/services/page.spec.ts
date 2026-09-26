import { TestBed } from '@angular/core/testing';

import { Page } from './page';

describe('Page', () => {
  let service: Page;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Page);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
