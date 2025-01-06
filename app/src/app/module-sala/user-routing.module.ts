import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SalaComponent } from './components/sala/sala.component';
import { GuardSalaGuard } from './guardianes/guard-sala.guard';

const routes: Routes = [
  {path: '', component: SalaComponent, pathMatch: 'full', canDeactivate: [GuardSalaGuard]}
];

@NgModule({

  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SalaRoutingModule { }
