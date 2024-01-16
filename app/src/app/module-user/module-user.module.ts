import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormUserComponent } from './components/form-user/form-user.component';
import { UserRoutingModule } from './user-routing.module';
import { ReactiveFormsModule } from "@angular/forms";




@NgModule({
  declarations: [
    FormUserComponent
  ],
  imports: [
    CommonModule,
    UserRoutingModule,
    ReactiveFormsModule
  ]
})
export class ModuleUserModule { }
