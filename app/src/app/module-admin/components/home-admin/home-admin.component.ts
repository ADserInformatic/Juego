import { Component, OnInit } from '@angular/core';
import { ApiAdminService } from '../../services/api-admin.service';

@Component({
  selector: 'app-home-admin',
  templateUrl: './home-admin.component.html',
  styleUrls: ['./home-admin.component.css']
})
export class HomeAdminComponent implements OnInit {

  public usuarios: Array<any> = []

  constructor( private apiServ: ApiAdminService) { }

  ngOnInit(): void {
    this.apiServ.getUsers().subscribe(res=>{
      console.log(res.data)
      this.usuarios = res.data
    })
  }

  deleteUs(item: any){
    if (confirm(`Seguro que desea eliminar el siguiente usuario: ${item.name}`)) {
      this.apiServ.deleteUser(item._id).subscribe(res=>{
        alert(res)
      })
    }
  }
}
