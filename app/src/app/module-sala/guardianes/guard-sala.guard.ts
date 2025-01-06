import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanDeactivate, RouterStateSnapshot, UrlTree } from '@angular/router';
import { map, Observable } from 'rxjs';
import { ServicGuardService } from '../services/servic-guard.service';

@Injectable({
  providedIn: 'root'
})
export class GuardSalaGuard implements CanActivate, CanDeactivate<unknown> {
  finalPartida!: boolean;
  constructor(private servGuard: ServicGuardService){}
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return true;
  }
  canDeactivate(
    component: unknown,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState?: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return  this.servGuard.observarGuard.asObservable().pipe(
        map(val =>{
          if(val){
            alert('Desea salir?')
            return true
          }else{
            if(confirm('Al salir de la partida pierde el dinero apostado en la misma. ¿Desea salir de todas formas?')){
              return true
            }else{
              return false
            }
          }
        })
      )

  }
  
}
