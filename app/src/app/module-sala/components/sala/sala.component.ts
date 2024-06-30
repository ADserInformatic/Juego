import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { io } from 'socket.io-client';
import { Jugada } from 'src/app/interfaces/jugada';
import { Jugador } from 'src/app/interfaces/jugador';

@Component({
  selector: 'app-sala',
  templateUrl: './sala.component.html',
  styleUrls: ['./sala.component.css']
})
export class SalaComponent implements OnInit {
  private jugadorVacio: Jugador = { 
    id: '',
    name: '',
    tantosPartida: 0,
    creditos: 0,
    valores: [{name: '', valor: 0}]
  };
  public nameSala!: string;
  private mentira!: any;
  private socket: any;
  public sala: any;
  public jugador: Jugador = this.jugadorVacio;
  public jugadorCont: Jugador = this.jugadorVacio
  public cantoConf: boolean = false;
  public cantora: string = '';
  public respuesta: any;
  public mensaje: string = '';
  public envido: boolean = true;
  private verCartas: BehaviorSubject<any> = new BehaviorSubject<any>(this.jugador.valores)

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
    
    
    this.socket.on('cantando', (res:any)=>{
      if(res.respuesta === 'quiero' || res.respuesta === 'noquiero' ){
        console.log(`El jugador ${this.jugadorCont.name} dice: ${res.respuesta} ${res.canto}`)
        return
      }else{
        console.log('bueeee')
      }
      res.jugador = this.jugadorCont
      this.respuesta = {
        jugador: this.jugador.name,
        canto: res.canto,
        mensaje: ''
      };
      this.cantoConf = true
      this.cantora = `El jugador ${res.jugador.name} dice: ${res.canto}`
    })
    this.socket.on('respuestaCanto', (res: any)=>{
      confirm(`Tu oponente dice ${res}`)
    })
    
    this.socket.on('resultadoDeCanto', (res: any)=>{
      this.mensaje = res.mensaje
      setTimeout(()=>{
        this.mensaje = ''
      }, 2000)
      this.resetSala(res.sala)
      this.envido = false
    })
    
    //desactivar el boton de envido
    this.verCartas.subscribe(res=>{
      this.envido = this.jugador.valores.length > 2 && !this.mentira
      console.log(this.envido)
    })
  }
  
  
  
  resetSala(res:any){
    // if(this.nameSala !== res.name){return}
    this.sala = res;
    this.sala.usuarios.forEach((element:any) => {
      if(element.id == this.cookies.get('jugador')){
        this.jugador = element
      }else{
        this.jugadorCont = element
      }
    });
    this.verCartas.next(this.jugador.valores)
  }

  //Acá armo el objeto que va para atrás cada vez que se tira una carta: el valor de la carta que viene en el parámetro, el nombre de la sala en la que está el usuario y el id del usuario.
  juega(val: any){
    console.log(val)
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
    if(canto == 'envido'){
      this.mentira = canto
    }
    let data = {
      sala: this.nameSala,
      jugador: this.jugador,
      canto
    }
    this.socket.emit('canto', data)
  }

  contestarCanto(resp: string){
    const respons = {
      jugador: this.jugadorCont,
      respuesta: resp,
      sala: this.nameSala,
      canto: this.respuesta.canto
    }
    if (resp === 'reenvido') {
      respons.canto = 'reenvido'

    }
    this.socket.emit('respuestaCanto', respons)
    this.cantoConf = !this.cantoConf
  }

}
