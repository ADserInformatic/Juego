import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {path: '', loadChildren: ()=> import('./module-user/module-user.module').then(m => m.ModuleUserModule)},
  {path: 'sala', loadChildren: ()=> import('./module-sala/module-sala.module').then(m => m.ModuleSalaModule)},
  {path: 'admin', loadChildren: ()=> import('./module-admin/module-admin.module').then(m => m.ModuleAdminModule)}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
