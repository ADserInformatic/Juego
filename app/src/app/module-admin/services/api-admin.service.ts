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

  getUsers(): Observable<any>{
    return this.http.get(this.apiUrl)
  }

  getRender(): Observable<any>{
    return this.http.get(`${this.apiUrl}/getRener`)
  }
  addUser(data:any): Observable<any>{
    return this.http.post(`${this.apiUrl}/addUser`, data)
  }

  addCredit(data: any, id: string): Observable<any>{
    return this.http.put(`${this.apiUrl}/addCredit/${id}`, data)
  }

  deleteUser(id: string): Observable<any>{
    return this.http.delete(`${this.apiUrl}/delete/${id}`)
  }
}
