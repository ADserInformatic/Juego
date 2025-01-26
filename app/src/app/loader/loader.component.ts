import { Component, OnInit } from '@angular/core';
import { ConexionInternaService } from 'src/app/services/conexion-interna.service';

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.css']
})
export class LoaderComponent {

  isLoading$ = this.loaderConect.loading$;

  constructor(private loaderConect: ConexionInternaService) {}

}
