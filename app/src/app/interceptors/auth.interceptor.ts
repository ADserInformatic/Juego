import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { finalize, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ConexionInternaService } from '../services/conexion-interna.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private servLogin: AuthService,
    private loaderConect: ConexionInternaService

  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.servLogin.getToken();
    this.loaderConect.show();
    if (token) {
      const cloned = request.clone({
        headers: request.headers.set('Authorization', `Bearer ${token}`)
      });
      return next.handle(cloned).pipe(
        finalize(() => this.loaderConect.hide())
      );
    }
    return next.handle(request).pipe(
      finalize(() => this.loaderConect.hide())
    );
  }
}
