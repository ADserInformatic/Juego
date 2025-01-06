import { TestBed } from '@angular/core/testing';

import { ServicGuardService } from './servic-guard.service';

describe('ServicGuardService', () => {
  let service: ServicGuardService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServicGuardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
