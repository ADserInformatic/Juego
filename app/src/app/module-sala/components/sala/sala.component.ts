import { Component, OnInit } from '@angular/core';
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
  public nameSala!: string;
  private socket: any;
  public sala: any;
  public jugador!: Jugador;
  public jugadorCont!: Jugador;
  public cantoConf: boolean = false;
  public cantora: string = ''

  constructor(
    private routeAct: ActivatedRoute,
    private cookies: CookieService
  ) { }

  ngOnInit(): void {
    this.routeAct.params.subscribe((res:any)=>{
      this.socket = io('http://localhost:3006',
       {
        query: {sala: res.sala}
      })
      this.socket.emit('connection', res)
      console.log(res)
      this.nameSala = res.sala;
      this.socket.emit('sala', res.idSala)
    })
    
    this.socket.on('sala', (res:any)=>{
      this.resetSala(res)
    })
    this.socket.on('muestra', (res: any)=>{
      this.resetSala(res)
    })

    this.socket.on('repartir', (res: any)=>{
      this.resetSala(res)
    })

    this.socket.on('cantando', (res: any)=>{
      let respuesta = {
        jugador: this.jugador.name,
        canto: res.canto,
        mensaje: ''
      };
      this.cantoConf = true
      this.cantora = `El jugador ${res.jugador.name} dice: ${res.canto}`
      // if (confirm()) {
      //   respuesta.mensaje = 'Quiero'
      //   this.socket.emit('respuestaCanto', respuesta)
      // }else{
      //   respuesta.mensaje = 'No quiero'
      //   this.socket.emit('respuestaCanto', respuesta)
      // }
    })
  }

  resetSala(res:any){
    // if(this.nameSala !== res.name){return}
    this.sala = res;
    console.log(res)
    this.sala.usuarios.forEach((element:any) => {
      if(element.id == this.cookies.get('jugador')){
        this.jugador = element
      }else{
        this.jugadorCont = element
      }
    });
  }

  //Acá armo el objeto que va para atrás cada vez que se tira una carta: el valor de la carta que viene en el parámetro, el nombre de la sala en la que está el usuario y el id del usuario.
  juega(val: any){
    const data: Jugada = {
      sala: this.nameSala,
      valor: val.valor,
      carta: val.name,
      idUser: this.cookies.get('jugador')
    }
    console.log(data)
    this.socket.emit('tirar', data)
  }

  repartir(){
    this.socket.emit('repartir', this.sala)
  }

  canto(canto: string){
    console.log(this.jugador, canto)
    let data = {
      sala: this.nameSala,
      jugador: this.jugador,
      canto
    }
    this.socket.emit('canto', data)
  }

}
