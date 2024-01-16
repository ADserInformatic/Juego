import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConsultasService {
  private uri: string = 'http://localhost:3006';

  constructor(private http: HttpClient) { }

  getSalas(): Observable<any>{
    return this.http.get(`${this.uri}/sala`)
  }

  getOneSala(id: any): Observable<any>{
    return this.http.get(`${this.uri}/sala/${id}`)
  }

  saveUser(dato: any): Observable<any>{
    return this.http.post(this.uri, dato)
  }

  createSala( data: any): Observable<any>{
    return this.http.post(`${this.uri}/sala`, data)
  }

  addUserToSala(id: string, dato:any): Observable<any>{
    console.log(dato)
    return this.http.put(`${this.uri}/sala/${id}`, dato)
  }
}
