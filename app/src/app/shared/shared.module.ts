import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BuscadorComponent } from './buscador/buscador.component';


@NgModule({
  declarations: [
   BuscadorComponent
  ],
  imports: [
    ReactiveFormsModule,
    CommonModule,
    FormsModule
  ],
  exports: [
    BuscadorComponent
  ]
})
export class SharedModule { }