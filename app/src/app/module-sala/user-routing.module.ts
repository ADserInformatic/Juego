import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GuardianGuard } from '../guardianes/guardian.guard';
import { SalaComponent } from './components/sala/sala.component';

const routes: Routes = [
  {path: '', component: SalaComponent, pathMatch: 'full', canDeactivate: [GuardianGuard]}
];

@NgModule({

  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SalaRoutingModule { }
