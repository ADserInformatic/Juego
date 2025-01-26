import { Component, OnInit } from '@angular/core';
import { ApiAdminService } from '../../services/api-admin.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';
import { ConsultasService } from 'src/app/services/consultas.service';
import { CookieService } from 'ngx-cookie-service';

@Component({
  selector: 'app-home-admin',
  templateUrl: './home-admin.component.html',
  styleUrls: ['./home-admin.component.css']
})
export class HomeAdminComponent implements OnInit {
  formPay!: FormGroup;
  formPass!: FormGroup;
  public usuarios: Array<any> = []
  public usersFilter: Array<any> = []
  public pagar: boolean = false
  public cambiarPass: boolean = false;

  constructor( 
    private apiServ: ApiAdminService,
    private apiCons: ConsultasService,
    private fb: FormBuilder,
    private authLog: AuthService,
    private router: Router,
    private cookie: CookieService
  ) { }

  ngOnInit(): void {
    this.traeUsers()

    this.formPay = this.fb.group({
      monto: ['', Validators.required],
      password: ['', Validators.required ]
    })

    this.formPass = this.fb.group({
      passOld: ['', [Validators.required, Validators.minLength(3)]],
      passNew: ['' , [Validators.required, Validators.minLength(3)]],
      passConf: ['' , [Validators.required, Validators.minLength(3)]]
    })
  }

  traeUsers(){
    this.apiCons.getUsers().subscribe(res=>{
      console.log(res.data)
      this.usuarios = res.data
      this.usersFilter = res.data
    })
  }

  actualizar(datos: any){
    console.log(datos)
    if (datos.length > 0) {
      this.usersFilter = datos
    }else{
      this.usersFilter = this.usuarios
    }
  }

  closed(){
    if(confirm('De veras desea cerrar sesión?')){
      this.authLog.logout()
      this.router.navigate(['/'])
    }
  }

  reset(item:any){
    if(confirm(`Desea resetear la contraseña de ${item.name}?`)){
      console.log(item._id)
      this.apiServ.resetPass(item.id).subscribe(res=>{
        alert(res.mensaje)
      })
    }
  }

  deleteUs(item: any){
    if (confirm(`Seguro que desea eliminar el siguiente usuario: ${item.name}`)) {
      this.apiServ.deleteUser(item._id).subscribe(res=>{
        alert(res)
      })
    }
  }

  formPayOn(){
    this.pagar = !this.pagar
  }

  pay(){
    console.log(this.formPay.value)
  }

  cambiar(){
    this.cambiarPass = !this.cambiarPass
  }

  sendPass(){
    if(this.formPass.value.passNew !== this.formPass.value.passConf){
      alert('La contraseña debe ser igual en los dos campos')
      return
    }
    console.log(this.formPass.value)
    const id = this.cookie.get('jugador')
    this.apiCons.newPass(id, this.formPass.value).subscribe(res=>{
      alert(res.mensaje)
      if(res.error){
        return
      }
      this.authLog.logout()
      this.cookie.delete('jugador')
      this.router.navigate(['/'])
    })

  }
}
