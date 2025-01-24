import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  public formUser!: FormGroup;
  private token!: string;

  constructor(
      private servLogin: AuthService,
      private fb: FormBuilder,
      private cookie: CookieService,
      private router: Router
  ) { }

  ngOnInit(): void {
    this.formUser = this.fb.group({
      name: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(3)]]
    })
  }

  userSend(){
    this.servLogin.login(this.formUser.value).subscribe(res=>{
      if(res.mensaje){
        alert(res.mensaje)
      }
      this.token = res.data.token; // Asumiendo que el token viene en la respuesta
      localStorage.setItem('token', this.token); // Almacena el token en localStorage
      // this.user = res.data.name
      this.cookie.set('jugador', res.data._id)
      this.router.navigate(['/appTruco']); // Redirige a la página de inicio de sesión
    })
    
  }

}
