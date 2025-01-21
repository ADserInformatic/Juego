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
  public salas: Array<any>= [];
  public user!: string;

  constructor(
    private servCons: ConsultasService,
    private fb: FormBuilder,
    private cookie: CookieService,
    private route: Router,
    private servLogin: AuthService
  ) { }

  ngOnInit(): void {
    this.user = this.cookie.get('jugador')

    this.formSala = this.fb.group({
      name: ['', [Validators.required]],
      apuesta: [0, [Validators.required, Validators.minLength(2)]]
    })
    
    this.traeSalas()

  }
  traeSalas(){
    this.servCons.getSalas().subscribe(res=>{
      this.salas = res.data
    })
  }

  createSala(){
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
      console.log(res)
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

  // solicitar(){
  //   if(confirm('Quiere solicitar usuario? Si acepta se')){

  //   }else{

  //   }
  // }

  closed(){
    if(confirm('Desea cerrar sesión?')){
      this.servLogin.logout()
      this.cookie.delete('jugador')
      this.route.navigate(['/'])
    }
  }
}
