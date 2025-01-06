import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ServicGuardService {
  
  observarGuard = new BehaviorSubject<boolean>(true)
}
