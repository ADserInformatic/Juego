import { TestBed } from '@angular/core/testing';

import { ConexionInternaService } from './conexion-interna.service';

describe('ConexionInternaService', () => {
  let service: ConexionInternaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConexionInternaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
