import { Component, OnInit } from '@angular/core';
import { ApiAdminService } from '../../services/api-admin.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { Router } from '@angular/router';
import { ConsultasService } from 'src/app/services/consultas.service';

@Component({
  selector: 'app-home-admin',
  templateUrl: './home-admin.component.html',
  styleUrls: ['./home-admin.component.css']
})
export class HomeAdminComponent implements OnInit {
  formPay!: FormGroup;
  public usuarios: Array<any> = []
  public usersFilter: Array<any> = []
  public pagar: boolean = false

  constructor( 
    private apiServ: ApiAdminService,
    private apiCons: ConsultasService,
    private fb: FormBuilder,
    private authLog: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.apiCons.getUsers().subscribe(res=>{
      console.log(res.data)
      this.usuarios = res.data
      this.usersFilter = res.data
    })

    this.formPay = this.fb.group({
      monto: ['', Validators.required],
      password: ['', Validators.required ]
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
    this.authLog.logout()
    this.router.navigate(['/'])
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
}
