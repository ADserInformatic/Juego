import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeAdminComponent } from './components/home-admin/home-admin.component';
import { AddUsersComponent } from './components/add-users/add-users.component';
import { AdminRoutingModule } from './admin-routing.module';
import { SharedModule } from '../shared/shared.module';
import { AddCreditComponent } from './components/add-credit/add-credit.component';



@NgModule({
  declarations: [
    HomeAdminComponent,
    AddUsersComponent,
    AddCreditComponent
  ],
  imports: [
    CommonModule,
    AdminRoutingModule,
    SharedModule
  ]
})
export class ModuleAdminModule { }
