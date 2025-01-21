import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { HomeAdminComponent } from "./components/home-admin/home-admin.component";
import { AuthGuard } from "../guards/auth.guard";


const routes: Routes = [
    {path: '', component: HomeAdminComponent, canActivate: [AuthGuard]}
]
@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})

export class AdminRoutingModule {}