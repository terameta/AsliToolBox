import { AuthModule } from "../../welcome/auth.module";
import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Routes, RouterModule } from "@angular/router";

import { DimeProcessService } from "./dimeprocess.service";
import { DimeprocessListComponent } from "./dimeprocess-list/dimeprocess-list.component";
import { DimeprocessDetailComponent } from "./dimeprocess-detail/dimeprocess-detail.component";
import { DimeprocessesComponent } from "./dimeprocesses/dimeprocesses.component";
import { DimeprocessToolbarComponent } from "./dimeprocess-toolbar/dimeprocess-toolbar.component";
import { DimeprocessComponent } from "./dimeprocess/dimeprocess.component";


const dimeProcessRoutes: Routes = [
	{ path: "dime/processes", pathMatch: "prefix", redirectTo: "dime/processes/process-list" },
	{ path: "process-list", component: DimeprocessListComponent },
	{ path: "process-detail/:id", component: DimeprocessDetailComponent }
];

@NgModule({
	imports: [
		CommonModule,
		RouterModule.forChild(dimeProcessRoutes),
		AuthModule
	],
	exports: [
		RouterModule
	],
	providers: [
	],
	declarations: [
		DimeprocessListComponent,
		DimeprocessDetailComponent,
		DimeprocessesComponent,
		DimeprocessToolbarComponent,
		DimeprocessComponent
	]
})
export class DimeprocessModule { }
