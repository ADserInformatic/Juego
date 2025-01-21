import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SalaComponent } from './components/sala/sala.component';
import { GuardSalaGuard } from './guardianes/guard-sala.guard';
import { AuthGuard } from '../guards/auth.guard';

const routes: Routes = [
  {path: '', component: SalaComponent, pathMatch: 'full', canDeactivate: [GuardSalaGuard], canActivate: [AuthGuard]}
];

@NgModule({

  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SalaRoutingModule { }
