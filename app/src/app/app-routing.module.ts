import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {path: '', loadChildren: ()=> import('./module-user/module-user.module').then(m => m.ModuleUserModule)},
  {path: 'sala', loadChildren: ()=> import('./module-sala/module-sala.module').then(m => m.ModuleSalaModule)}

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
