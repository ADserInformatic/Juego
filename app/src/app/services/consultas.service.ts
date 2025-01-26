import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConsultasService {
  private uri: string = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getSalas(): Observable<any>{
    return this.http.get(`${this.uri}/sala`)
  }

  getOneSala(id: any): Observable<any>{
    return this.http.get(`${this.uri}/sala/${id}`)
  }

  deleteSala(id: any): Observable<any>{
    return this.http.delete(`${this.uri}/sala/${id}`)
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

  getUsers(): Observable<any>{
    return this.http.get(`${this.uri}/getUsers`)
  }

  getUser(id: string): Observable<any>{
    return this.http.get(`${this.uri}/getUser/${id}`)
  }

  newPass(id: string, datos: any): Observable<any>{
    return this.http.put(`${this.uri}/changePass/${id}`, datos)
  }

}
