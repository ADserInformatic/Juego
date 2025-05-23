import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanDeactivate, RouterStateSnapshot, UrlTree } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { map, Observable } from 'rxjs';
import { ServicGuardService } from '../services/servic-guard.service';

@Injectable({
  providedIn: 'root'
})
export class GuardSalaGuard implements CanDeactivate<unknown> {
  finalPartida!: boolean;
  constructor(private servGuard: ServicGuardService,
    private cookie: CookieService){}

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
            if(this.cookie.get('abandono')){
              return true
            }
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
