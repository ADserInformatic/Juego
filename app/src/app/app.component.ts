import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { io } from "socket.io-client";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  @ViewChild('card') opcion!: ElementRef;
  @ViewChild('jugadores') jugadores!: ElementRef;
  @Input() users: Array<any> = [];
  private socket: any;
  public cartas: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.socket = io('http://localhost:3006')
    this.socket.on('jugadores', (data: any) => {
      this.users = data
      this.users.forEach(e => {
        this.jugadores.nativeElement.innerHTML += `<div class="jugador1">
        <h4>${e.name}</h4>
        <div class="valores">
          <p>Valores</p>
          <i>${e.valores}</i>
        </div>
      </div>`
      })

    })
    this.socket.on('dato', (dato: any) => {
      this.users.forEach(e => {
        if (e.id == dato.id) {
          e.valores.push(e.dato)
        }
      })
    })

  }


  title = 'app';

  ejecutar() {
    this.socket.emit('dato', { dato: this.opcion.nativeElement.value, id: this.socket.id, valores: [] })
  }
}
