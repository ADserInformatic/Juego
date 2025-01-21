import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CookieService } from 'ngx-cookie-service';
import { ConsultasService } from 'src/app/services/consultas.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  public formUser!: FormGroup;

  constructor(
      private servCons: ConsultasService,
      private fb: FormBuilder,
      private cookie: CookieService,
  ) { }

  ngOnInit(): void {
    this.formUser = this.fb.group({
      name: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(3)]]
    })
  }

  userSend(){
    alert('Ruta no creada')
    return
    this.servCons.saveUser(this.formUser.value).subscribe(res=>{
      if(res.mensaje){
        alert(res.mensaje)
      }
      // this.user = res.data.name
      // this.cookie.set('jugador', res.data._id)
      // this.servCons.getSalas().subscribe(res=>{
      //   this.salas = res.data
      // })
    })
    
  }

}
