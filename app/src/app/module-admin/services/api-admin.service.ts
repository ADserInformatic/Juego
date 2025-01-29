import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiAdminService {
  private apiUrl: string = environment.apiUrl

  constructor(
    private http: HttpClient
  ) { }

  getRender(): Observable<any>{
    return this.http.get(`${this.apiUrl}/getRener`)
  }

  getAdmin(id: string): Observable<any>{
    return this.http.get( `${this.apiUrl}/dataAdmin/${id}`)
  }

  addUser(data:any): Observable<any>{
    return this.http.post(`${this.apiUrl}/addUser`, data)
  }

  addCredit(data: any, id: string): Observable<any>{
    return this.http.put(`${this.apiUrl}/addCredit/${id}`, data)
  }

  removeCredit(data: any, id: string): Observable<any>{
    return this.http.put(`${this.apiUrl}/removeCredit/${id}`, data)
  }

  deleteUser(id: string): Observable<any>{
    return this.http.delete(`${this.apiUrl}/delete/${id}`)
  }

  resetPass(id: string): Observable<any>{
    return this.http.put(`${this.apiUrl}/resetPass/${id}`, id)
  }

  sendMonto(id: string, datos: any): Observable<any>{
    return this.http.put( `${this.apiUrl}/clearEarning/${id}`, datos)
  }
}
