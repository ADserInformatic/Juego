import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { io } from 'socket.io-client';
import { Jugada } from 'src/app/interfaces/jugada';
import { Jugador } from 'src/app/interfaces/jugador';

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
  public sala: any;
  public jugador!: Jugador;

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
      this.socket.emit('sala', res.idSala)
    })
    this.mostrar.subscribe(res=>{
      this.sala = res;
    })
    this.socket.on('sala', (res:any)=>{
      this.sala = res;
      console.log(res)
      this.sala.usuarios.forEach((element:any) => {
        if(element.id == this.cookies.get('jugador')){
          this.jugador = element
        }
      });
    })
    this.socket.on('muestra', (res: any)=>{
      console.log(res)
      this.mostrar.emit(res)
    })
  }

  juega(val: number){
    const data: Jugada = {
      sala: this.nameSala,
      valor: val,
      idUser: this.cookies.get('jugador')
    }
    this.socket.emit('tirar', data)
  }

}
