import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { BehaviorSubject } from 'rxjs';
import { io } from 'socket.io-client';
import { Jugada } from 'src/app/interfaces/jugada';
import { Jugador } from 'src/app/interfaces/jugador';
import { ServicGuardService } from '../../services/servic-guard.service';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment.prod';

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
    puedeFlor: false,
    creditos: 0,
    valores: [{ name: '', valor: 0 }]
  };
  public cantoActual: string = '';
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
  public cantoI: string = '';
  public btnMentiras: boolean = true;
  public invertCards!: boolean;
  public salir: boolean = false;
  public tantos1: Array<number> = []
  public tantosCont1: Array<number> = []
  public tantos2: Array<number> = []
  public tantosCont2: Array<number> = []
  public tantos3: Array<number> = []
  public tantosCont3: Array<number> = []
  public buenas: boolean = false;
  public buenasCont: boolean = false;
  private url: string = environment.apiUrl;
  public time!: any;
  public faltaResp: boolean = false;


  private verCartas: BehaviorSubject<any> = new BehaviorSubject<any>(this.jugador.valores)

  constructor(
    private routeAct: ActivatedRoute,
    private cookies: CookieService,
    private verGuard: ServicGuardService,
    private router: Router,
    private servLogin: AuthService
  ) { }

  ngOnInit(): void {
    this.routeAct.params.subscribe((res: any) => {
      this.socket = io(this.url,
        {
          query: { sala: res.sala }
        })
      this.socket.emit('connection', res)
      this.nameSala = res.sala;
      this.socket.emit('sala', res.idSala)
    })
    this.socket.on('sala', (res: any) => {
      console.log(res)
      this.resetSala(res)
    })
    this.socket.on('muestra', (res: any) => {
      if (res.finish && res.rivalAlMazo) {
        if (res.cantosenmano.florNegada) {
          this.mensaje = 'Jugador al mazo, compensando puntos y repartiendo...'
        } else {
          this.mensaje = 'Jugador al mazo, repartiendo...'
        }
      } else {
        if (res.finish && res.cantosenmano.florNegada) {
          this.mensaje = 'Flor negada, compensando puntos y repartiendo...'
        } else {
          if (res.finish && res.rivalAusente) {
            this.mensaje = 'Tiempo Agotado...Repartiendo...'
          } else {
            if (res.finish) {
              this.mensaje = 'Repartiendo...'
            }
          }
        }
      }
      this.resetSala(res)
    })
    this.socket.on('repartir', (res: any) => {
      this.resetSala(res)
      this.mensaje = ''
    })
    this.socket.on('cantando', (res: any) => {
      console.log(res)
      if (this.time > 1) { this.time = 0 };
      this.cantoI = res.canto
      res.jugador = this.jugadorCont
      this.respuesta = {
        jugador: this.jugador.name,
        canto: res.canto,
        mensaje: ''
      };
      this.envido = res.cantosenmano.boolEnvido
      this.reEnvido = res.cantosenmano.boolReEnvido
      this.realEnvido = res.cantosenmano.boolRealEnvido
      this.faltaEnvido = res.cantosenmano.boolFaltaEnvido;
      this.flor = res.cantosenmano.boolFlor;
      this.florFlor = res.cantosenmano.boolFlorFlor;
      this.contraFlor = res.cantosenmano.boolContraFlor;
      this.florMeachico = res.cantosenmano.boolFlorMeAchico;
      this.truco = res.cantosenmano.boolTruco;
      this.reTruco = res.cantosenmano.boolReTruco;
      this.valeCuatro = res.cantosenmano.boolValeCuatro;
      if (this.envido || this.realEnvido || this.faltaEnvido) {
        this.btnMentiras = false
      }
      if (res.respuesta === 'quiero' || res.respuesta === 'noquiero') {
        return
      }
      this.cantoI = res.cantosenmano.canto
      if (res.cantosenmano.jugador == this.cookies.get('jugador')) {
        this.cantoConf = false
      } else {
        this.cantoConf = res.cantosenmano.faltaRespuesta
      }
      this.faltaResp = res.cantosenmano.faltaRespuesta
      this.cantora = `El jugador ${res.jugador.name} dice: ${this.cantoI}`
    })
    this.socket.on('respuestaCanto', (res: any) => {
      confirm(`Tu oponente dice ${res}`)
    })
    this.socket.on('resultadoDeCanto', (res: any) => {
      console.log(res)
      this.mensaje = res.mensaje
      setTimeout(() => {
        this.mensaje = ''
      }, 5000)

      this.resetSala(res.sala)
      this.cantoConf = false
    })
    this.socket.on('salaAbandonada', (res: any) => {
      this.mensaje = res.mensaje
      setTimeout(() => {
        this.mensaje = ''
        this.cookies.set('abandono', res.jugador)
        this.router.navigate(['/appTruco'])
      }, 3000)
    })
    this.socket.on('time', (res: any) => {
      this.time = res
      if (this.time === 1) {
        setTimeout(() => {
          this.time = 0
        }, 1000);
      }
    })
    //desactivar el boton de envido
    this.verCartas.subscribe(res => {
      this.mentira = this.envido || this.realEnvido || this.faltaEnvido
      this.btnMentiras = this.jugador.valores.length > 2 && !this.mentira
    })
  }
  resetSala(res: any) {
    if (this.time > 1) { this.time = 0 };
    this.sala = res;
    this.envido = res.cantosenmano.boolEnvido
    this.reEnvido = res.cantosenmano.boolReEnvido
    this.realEnvido = res.cantosenmano.boolRealEnvido
    this.faltaEnvido = res.cantosenmano.boolFaltaEnvido;
    this.flor = res.cantosenmano.boolFlor;
    this.florFlor = res.cantosenmano.boolFlorFlor;
    this.contraFlor = res.cantosenmano.boolContraFlor;
    this.florMeachico = res.cantosenmano.boolFlorMeAchico;
    this.truco = res.cantosenmano.boolTruco    ;
    this.reTruco = res.cantosenmano.boolReTruco;
    this.valeCuatro = res.cantosenmano.boolValeCuatro;
    this.cantoI = res.cantosenmano.canto
    if (res.cantosenmano.jugador == this.cookies.get('jugador')) {
      this.cantoConf = false
    } else {
      this.cantoConf = res.cantosenmano.faltaRespuesta
    }
    this.faltaResp = res.cantosenmano.faltaRespuesta
    this.sala.usuarios.forEach((element: any) => {
      if (element.id == this.cookies.get('jugador')) {
        this.jugador = element
      } else {
        this.jugadorCont = element
      }
    });
    this.cantora = `El jugador ${this.jugadorCont.name} dice: ${this.cantoI}`
    if (this.truco) {
      this.cantoActual = "reTruco"
    }
    if (this.truco && this.reTruco) {
      this.cantoActual = "valeCuatro"
    }
    this.invertCards = this.jugador.name == this.sala.usuarios[0].name
    this.tantos1 = []
    this.tantosCont1 = []
    this.tantos2 = []
    this.tantosCont2 = []
    this.tantos3 = []
    this.tantosCont3 = []
    if (this.jugador.tantos < 16) {
      for (let i = 0; i < this.jugador.tantos; i++) {
        this.tantos1.push(i)
        if (i > 3) {
          break
        }
      }
      this.pintarPuntos(this.jugador.tantos, this.tantos2, 5, 8)
      this.pintarPuntos(this.jugador.tantos, this.tantos3, 10, 13)
    } else {
      this.buenas = true
      for (let i = 15; i < this.jugador.tantos; i++) {
        this.tantos1.push(i)
        if (i > 18) {
          break
        }
      }
      this.pintarPuntos(this.jugador.tantos, this.tantos2, 20, 23)
      this.pintarPuntos(this.jugador.tantos, this.tantos3, 25, 28)
    }
    if (this.jugadorCont.tantos < 16) {
      for (let i = 0; i < this.jugadorCont.tantos; i++) {
        this.tantosCont1.push(i)
        if (i > 3) {
          break
        }
      }
      this.pintarPuntos(this.jugadorCont.tantos, this.tantosCont2, 5, 8)
      this.pintarPuntos(this.jugadorCont.tantos, this.tantosCont3, 10, 13)
    } else {
      this.buenasCont = true
      for (let i = 15; i < this.jugadorCont.tantos; i++) {
        this.tantosCont1.push(i)
        if (i > 18) {
          break
        }
      }
      this.pintarPuntos(this.jugadorCont.tantos, this.tantosCont2, 20, 23)
      this.pintarPuntos(this.jugadorCont.tantos, this.tantosCont3, 25, 28)
    }
    this.verCartas.next(this.jugador.valores)
    this.verGuard.observarGuard.next(res.partidaFinalizada)
  }
  //Acá armo el objeto que va para atrás cada vez que se tira una carta: el valor de la carta que viene en el parámetro, el nombre de la sala en la que está el usuario y el id del usuario.
  juega(val: any) {
    const data: Jugada = {
      sala: this.nameSala,
      valor: val.valor,
      carta: val.name,
      idUser: this.cookies.get('jugador')
    }
    this.socket.emit('tirar', data)
  }
  repartir() {
    this.socket.emit('repartir', this.sala)
  }
  canto(canto: string) {
    this.faltaResp = true
    if (this.time > 1) { this.time = 0 };
    if (this.truco && canto === 'envido') {
    }
    if (canto === 'envido' || canto === 'realEnvido' || canto === 'faltaEnvido') {
      this.btnMentiras = false
    }
    if (canto === 'truco') {
      this.truco = true
      this.jugador.juega = false
    }
    let data = {
      sala: this.nameSala,
      jugador: this.jugador,
      canto
    }
    this.socket.emit('canto', data)
    if (canto === 'flor') {
      this.cantoConf = false
    }
  }
  contestarCanto(resp: string, bool?: boolean) {
    if (this.time > 1) { this.time = 0 };
    if (this.truco && resp === 'primEnvido') {
      if (this.selected.nativeElement.value === 'El envido va primero') {
        console.log('El envido va primero')
        return
      }
      let data = {
        sala: this.nameSala,
        jugador: this.jugador,
        canto: this.selected.nativeElement.value
      }
      this.socket.emit('canto', data)
      this.cantoConf = !this.cantoConf
      return
    }
    if (resp === 'reTruco') {
      this.reTruco = true
      this.jugador.juega = false
    }
    const respons = {
      jugador: this.jugador,
      respuesta: resp,
      sala: this.nameSala,
      canto: this.cantoI
    }
    this.socket.emit('respuestaCanto', respons)
    this.cantoConf = !this.cantoConf
    if (bool === false) {
      this.cantoConf = bool
    }
  }
  pintarPuntos(jugador: number, puntos: Array<any>, min: number, max: number) {
    if (jugador > min) {
      for (let i = min; i < jugador; i++) {
        puntos.push(i)
        if (i > max) {
          break
        }
      }
    }
  }
  alMazo() {
    let data = {
      sala: this.sala.name,
      jugador: this.jugador
    }
    this.socket.emit('meVoyAlMazo', data)
  }
  cancel() {
    this.salir = !this.salir
  }
  closed() {
    if (confirm('Desea cerrar sesión?')) {
      this.servLogin.logout()
      this.cookies.delete('jugador')
      this.router.navigate(['/'])
    }
  }
  abandonar() {
    if (confirm('Al abandonar la sala pierde el credito en juego. Desea abandonar de todos modos?')) {
      this.socket.emit('abandonarSala', { sala: this.sala.name, idUser: this.jugador.id })
      this.cookies.set('abandono', 'sí')
      this.salir = false
      this.mensaje = "Saliendo..."
      setTimeout(() => {
        this.router.navigate(['/appTruco'])
        this.mensaje = ""
      }, 3000)
    }
  }
}
