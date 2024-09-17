import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-home-admin',
  templateUrl: './home-admin.component.html',
  styleUrls: ['./home-admin.component.css']
})
export class HomeAdminComponent implements OnInit {

  public usuarios: Array<any> = [
    {name: 'Juan', credit: '1200'},
    {name: 'Pablo', credit: '11000'},
    {name: 'Segundo', credit: '12000'}
  ]

  constructor() { }

  ngOnInit(): void {
  }

}
