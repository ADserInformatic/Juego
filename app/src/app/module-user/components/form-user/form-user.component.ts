import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { AuthService } from 'src/app/services/auth.service';
import { ConsultasService } from 'src/app/services/consultas.service';

@Component({
  selector: 'app-form-user',
  templateUrl: './form-user.component.html',
  styleUrls: ['./form-user.component.css']
})
export class FormUserComponent implements OnInit {
  public formSala!: FormGroup;
  public formPass!: FormGroup;
  public salas: Array<any>= [];
  public user: any = {id: '', name: '', credito: 0};
  public cambiarPass: boolean = false;
  public isAdmin: any;


  constructor(
    private servCons: ConsultasService,
    private fb: FormBuilder,
    private cookie: CookieService,
    private route: Router,
    private servLogin: AuthService
  ) { }

  ngOnInit(): void {
    this.isAdmin = this.cookie.get('isAMadafaka?')

    this.user.id = this.cookie.get('jugador')

    this.servCons.getUser(this.user.id).subscribe(res=>{
      this.user.name = res.data.name
      this.user.credito = res.data.credito
    })

    this.formSala = this.fb.group({
      name: ['', [Validators.required]],
      apuesta: [0, [Validators.required, Validators.minLength(2)]]
    })

    this.formPass = this.fb.group({
      passOld: ['', [Validators.required, Validators.minLength(3)]],
      passNew: ['' , [Validators.required, Validators.minLength(3)]],
      passConf: ['' , [Validators.required, Validators.minLength(3)]]
    })
    
    this.traeSalas()

  }
  traeSalas(){
    this.servCons.getSalas().subscribe(res=>{
      this.salas = res.data
    })
  }

  createSala(){
    if(this.formSala.value.apuesta > this.user.credito){
      alert('La apuesta no puede superar el credito disponible')
      return
    }
    const datos = {
      name: this.formSala.value.name,
      apuesta: this.formSala.value.apuesta,
      usuarios: [{
        id: this.cookie.get('jugador'),
        valores: [],
        name: 'Jugador 1'}]
    }
    this.servCons.createSala(datos).subscribe(res=>{
      this.datosSala(res)
    })

  }

  sala(e: any){
    const dato = {
      id: this.cookie.get('jugador'),
      valores: [],
      name: 'Jugador 2'}
    this.servCons.addUserToSala(e._id, dato).subscribe(res=>{
      this.datosSala(res)
    })
    // this.servCons.getOneSala(e._id).subscribe(res=>{
    //   this.datosSala(res)
    // })
  }

  datosSala(res: any){
    if(res.mensaje){
      alert(res.mensaje)
    }
      const datos = {
        sala: res.data.name,
        idSala: res.data._id,
        user: this.user}
    if(res.denegado){return}
    this.route.navigate(['/sala', datos])
  }

  deleteSala(id: any){
    this.servCons.deleteSala(id).subscribe(res=>{
      alert(res.mensaje)
      this.traeSalas()
    })
  }

  closed(){
    if(confirm('Desea cerrar sesión?')){
      this.servLogin.logout()
      this.cookie.delete('jugador')
      this.route.navigate(['/'])
    }
  }

  cambiar(){
    this.cambiarPass = true
  }
  cerrar(){
    this.cambiarPass = false
  }

  sendPass(){
    if(this.formPass.value.passNew !== this.formPass.value.passConf){
      alert('La contraseña debe ser igual en los dos campos')
      return
    }
    const id = this.cookie.get('jugador')
    this.servCons.newPass(id, this.formPass.value).subscribe(res=>{
      alert(res.mensaje)
      if(res.error){
        return
      }
      this.servLogin.logout()
      this.cookie.delete('jugador')
      this.route.navigate(['/'])
    })

  }
}
