import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiAdminService } from '../../services/api-admin.service';

@Component({
  selector: 'app-add-users',
  templateUrl: './add-users.component.html',
  styleUrls: ['./add-users.component.css']
})
export class AddUsersComponent implements OnInit {
  formGrup!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private servApi: ApiAdminService
  ) { }

  ngOnInit(): void {
    this.formGrup = this.fb.group({
      name: ['', Validators.required],
      credito: [0, [Validators.required, Validators.minLength(2)]],
      //password: ['', [Validators.required, Validators.minLength(3)]]
    })
  }

  send(){
    if(confirm(`Asegurese de que los datos son correctos:
      Nombre: ${this.formGrup.value.name},
      Créditos: ${this.formGrup.value.credito}`)){
        this.servApi.addUser(this.formGrup.value).subscribe(res=>{
          alert(res.mensaje)
        })
      }
    
  }

}
