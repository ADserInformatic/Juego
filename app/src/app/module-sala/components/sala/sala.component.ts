import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
  @ViewChild('slected') selected!: ElementRef;
  private jugadorVacio: Jugador = {
    id: '',
    name: '',
    juega: false,
    puedeCantar: true,
    canto: '',
    tantos: 0,
    creditos: 0,
    valores: [{ name: '', valor: 0 }]
  };
  public cantoActual: string = 'truco';
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
  public envido: boolean = false;
  public reEnvido: boolean = false;
  public realEnvido: boolean = false;
  public faltaEnvido: boolean = false;
  public flor: boolean = false;
  public florFlor: boolean = false;
  public contraFlor: boolean = false;
  public florMeachico: boolean = false;
  public truco: boolean = false;
  public reTruco: boolean = false;
  public valeCuatro: boolean = false;
  private cantoI: string = '';
  public btnMentiras: boolean = true;
  public invertCards!: boolean;
  public salir: boolean = false;




  private verCartas: BehaviorSubject<any> = new BehaviorSubject<any>(this.jugador.valores)

  constructor(
    private routeAct: ActivatedRoute,
    private cookies: CookieService
  ) { }

  ngOnInit(): void {
    this.routeAct.params.subscribe((res: any) => {
      this.socket = io('http://localhost:3006',
        {
          query: { sala: res.sala }
        })
      this.socket.emit('connection', res)
      this.nameSala = res.sala;
      this.socket.emit('sala', res.idSala)
    })

    this.socket.on('sala', (res: any) => {
      this.resetSala(res)
    })
    this.socket.on('muestra', (res: any) => {
      this.resetSala(res)
      console.log(res)
    })

    this.socket.on('repartir', (res: any) => {
      this.resetSala(res)

      console.log(res)
    })

    this.socket.on('cantando', (res: any) => {
      console.log(res)
      this.cantoI = res.canto
      
      res.jugador = this.jugadorCont
      this.respuesta = {
        jugador: this.jugador.name,
        canto: res.canto,
        mensaje: ''
      };
      this.envido = res.cantosenmano.boolenvido;
      this.reEnvido = res.cantosenmano.boolreenvido;
      this.realEnvido = res.cantosenmano.boolrealenvido;
      this.faltaEnvido = res.cantosenmano.boolfaltaenvido;
      this.flor = res.cantosenmano.boolflor;
      this.florFlor = res.cantosenmano.boolflorflor;
      this.contraFlor = res.cantosenmano.boolcontraflor;
      this.florMeachico = res.cantosenmano.boolflormeachico;
      this.truco = res.cantosenmano.booltruco;
      this.reTruco = res.cantosenmano.boolretruco;
      this.valeCuatro = res.cantosenmano.boolvalecuatro;

      if(this.envido || this.realEnvido || this.faltaEnvido){
        this.btnMentiras = false
      }
      if (res.respuesta === 'quiero' || res.respuesta === 'noquiero') {
        console.log(`El jugador ${this.jugadorCont.name} dice: ${res.respuesta} ${res.canto}`)
        return
      } else {
        console.log('bueeee',)
        //this.contestarCanto(res.respuesta)
      }

      this.cantoConf = true
      this.cantora = `El jugador ${res.jugador.name} dice: ${res.canto}`
    })

    this.socket.on('respuestaCanto', (res: any) => {
      console.log("tu oponente dice: ", res)
      confirm(`Tu oponente dice ${res}`)
    })

    this.socket.on('resultadoDeCanto', (res: any) => {
      this.mensaje = res.mensaje
      setTimeout(() => {
        this.mensaje = ''
      }, 2000)
      console.log(res.sala)
      this.resetSala(res.sala)
      // this.envido = false
    })

    //desactivar el boton de envido
    this.verCartas.subscribe(res => {
      this.mentira = this.envido || this.realEnvido || this.faltaEnvido
      this.btnMentiras = this.jugador.valores.length > 2 && !this.mentira
    })
  }

  resetSala(res: any) {
    // if(this.nameSala !== res.name){return}
    this.sala = res;
    console.log(res)
    this.envido = res.cantosenmano.boolenvido
    this.reEnvido = res.cantosenmano.boolreenvido
    this.realEnvido = res.cantosenmano.boolrealenvido
    this.faltaEnvido = res.cantosenmano.boolfaltaenvido;
    this.flor = res.cantosenmano.boolflor;
    this.florFlor = res.cantosenmano.boolflorflor;
    this.contraFlor = res.cantosenmano.boolcontraflor;
    this.florMeachico = res.cantosenmano.boolflormeachico;
    this.truco = res.cantosenmano.booltruco;
    this.reTruco = res.cantosenmano.boolretruco;
    this.valeCuatro = res.cantosenmano.boolvalecuatro;
    

    this.sala.usuarios.forEach((element: any) => {
      if (element.id == this.cookies.get('jugador')) {
        this.jugador = element
      } else {
        this.jugadorCont = element
      }
    });
    this.verCartas.next(this.jugador.valores)
    this.invertCards = this.jugador.name == this.sala.usuarios[0].name
    console.log(this.invertCards)
  }

  //Acá armo el objeto que va para atrás cada vez que se tira una carta: el valor de la carta que viene en el parámetro, el nombre de la sala en la que está el usuario y el id del usuario.
  juega(val: any) {
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

  repartir() {
    console.log(this.sala)
    this.socket.emit('repartir', this.sala)
  }

  canto(canto: string) {
    if(this.truco && canto === 'envido'){

    }
    if (canto === 'envido' || canto === 'realEnvido' || canto === 'faltaEnvido') {
      this.btnMentiras = false
    }
    if(canto === 'truco'){
      this.truco = true
    }
    let data = {
      sala: this.nameSala,
      jugador: this.jugador,
      canto
    }
    this.socket.emit('canto', data)
  }

  contestarCanto(resp: string) {
    if(this.truco && resp === 'primEnvido'){
      if(this.selected.nativeElement.value === 'El envido va primero'){
        console.log(this.selected.nativeElement.value)
        return
      }
      let data = {
        sala: this.nameSala,
        jugador: this.jugador,
        canto: this.selected.nativeElement.value
      }
      console.log(data)
      this.socket.emit('canto', data)
      this.cantoConf = !this.cantoConf
      return
    }
    const respons = {
      jugador: this.jugadorCont,
      respuesta: resp,
      sala: this.nameSala,
      canto: this.cantoI
    }
    console.log(respons)
    this.socket.emit('respuestaCanto', respons)
    this.cantoConf = !this.cantoConf
  }

  cancel(){
    this.salir = !this.salir
  }
}
