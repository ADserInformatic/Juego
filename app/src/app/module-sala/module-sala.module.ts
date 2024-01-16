import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalaComponent } from './components/sala/sala.component';
import { SalaRoutingModule } from './user-routing.module';



@NgModule({
  declarations: [
    SalaComponent
  ],
  imports: [
    CommonModule,
    SalaRoutingModule
  ]
})
export class ModuleSalaModule { }
