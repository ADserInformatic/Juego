import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { io } from 'socket.io-client';

@Component({
  selector: 'app-sala',
  templateUrl: './sala.component.html',
  styleUrls: ['./sala.component.css']
})
export class SalaComponent implements OnInit {
  @Output() mostrar: EventEmitter<any> = new EventEmitter<any>()
  public nameSala!: string;
  public nameUser!: string;
  private socket: any;
  public dato: any;

  constructor(
    private routeAct: ActivatedRoute,
    private cookies: CookieService
  ) { }

  ngOnInit(): void {
    this.socket = io('http://localhost:3006')
    this.routeAct.params.subscribe((res:any)=>{
      this.socket.emit('connection', res)
      this.nameSala = res.sala;
      this.nameUser = res.user
    })
    this.mostrar.subscribe(res=>{
      this.dato = res;
    })

    this.socket.on('muestra', (res: any)=>{
      console.log(res)
      this.mostrar.emit(res)
    })
  }

  juega(){
    const data = {
      sala: this.nameSala,
      value: '6',
      id: this.cookies.get('jugador'),
      jugador: '1'
    }
    this.socket.emit('tirar', data)
  }

}
