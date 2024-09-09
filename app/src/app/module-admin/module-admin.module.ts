import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeAdminComponent } from './components/home-admin/home-admin.component';
import { AddUsersComponent } from './components/add-users/add-users.component';
import { AdminRoutingModule } from './admin-routing.module';



@NgModule({
  declarations: [
    HomeAdminComponent,
    AddUsersComponent
  ],
  imports: [
    CommonModule,
    AdminRoutingModule
  ]
})
export class ModuleAdminModule { }
