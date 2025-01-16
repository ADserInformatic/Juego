import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiAdminService } from '../../services/api-admin.service';

@Component({
  selector: 'app-add-credit',
  templateUrl: './add-credit.component.html',
  styleUrls: ['./add-credit.component.css']
})
export class AddCreditComponent implements OnInit {
  formGrup!: FormGroup;
  public users: Array<any> = [{_id: 'kjkjuhkjhkj', name: 'Juan', credit: 300}, {_id: 'kjkjuh6666kj', name: 'John', credit: 7000}]

  constructor(
    private fb: FormBuilder,
    private servApi: ApiAdminService
  ) { }

  ngOnInit(): void {
    this.formGrup = this.fb.group({
      name: '',
      credit: [Number, Validators.required],
      _id: '',
      password: ['', [Validators.required, Validators.minLength(3)]]
    })
  }

  obtenerDato(e: any){
    this.formGrup.value.name = e.name;
    this.formGrup.value._id = e._id;
  }

  addC(){
    console.log(this.formGrup.value)
    if(confirm(`Asegurese de que los datos son correctos:
      Nombre: ${this.formGrup.value.name},
      Créditos: ${this.formGrup.value.credit}`)){
        this.servApi.addCredit(this.formGrup.value, this.formGrup.value._id).subscribe(res=>{
          console.log(res)
        })
      }
  }

}
