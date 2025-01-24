import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormUserComponent } from './components/form-user/form-user.component';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from '../guards/auth.guard';

const routes: Routes = [
  {path: '', redirectTo: '/login', pathMatch: 'full' }, // Redirige a '/home' por defecto
  {path: 'login', component: LoginComponent, pathMatch: 'full'},
  {path: 'appTruco', component: FormUserComponent, pathMatch: 'full'}
  //{path: 'appTruco', component: FormUserComponent, pathMatch: 'full', canActivate: [AuthGuard]}
];

@NgModule({

  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserRoutingModule { }
