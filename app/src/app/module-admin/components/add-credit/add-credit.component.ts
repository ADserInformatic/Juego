import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiAdminService } from '../../services/api-admin.service';

@Component({
  selector: 'app-add-credit',
  templateUrl: './add-credit.component.html',
  styleUrls: ['./add-credit.component.css']
})
export class AddCreditComponent implements OnInit {
  formGrup!: FormGroup;
  @Input() usuarios: Array<any> = []
  private name!: string;
  private id!: string;

  constructor(
    private fb: FormBuilder,
    private servApi: ApiAdminService
  ) { }

  ngOnInit(): void {
    this.formGrup = this.fb.group({
      name: '',
      credit: [0 ,  [Validators.required, Validators.minLength(2)]],
      _id: '',
      // password: ['', [Validators.required, Validators.minLength(3)]]
    })
  }

  obtenerDato(e: any){
    console.log(e)
    this.name = e.name;
    this.id = e._id;
  }

  addC(){
    this.formGrup.value.name = this.name
    this.formGrup.value._id = this.id
    if(confirm(`Asegurese de que los datos son correctos:
      Nombre: ${this.formGrup.value.name},
      Créditos: ${this.formGrup.value.credit}`)){
        this.servApi.addCredit(this.formGrup.value, this.formGrup.value._id).subscribe(res=>{
          alert(res.mensaje)
        })
      }
  }

  remC(){
    this.formGrup.value.name = this.name
    this.formGrup.value._id = this.id
    if(confirm(`Asegurese de que los datos son correctos:
      Nombre: ${this.formGrup.value.name},
      Créditos: ${this.formGrup.value.credit}`)){
        this.servApi.removeCredit(this.formGrup.value, this.formGrup.value._id).subscribe(res=>{
          alert(res.mensaje)
        })
      }
  }

}
