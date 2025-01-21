import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl; 
  private token!: string;

  constructor(private http: HttpClient) { }

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { username, password })
      .pipe(tap(res => {
        this.token = res.token; // Asumiendo que el token viene en la respuesta
        localStorage.setItem('token', this.token); // Almacena el token en localStorage
      }));
  }

  logout() {
    this.token = '';
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }
}
