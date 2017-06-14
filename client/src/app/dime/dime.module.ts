import { FormsModule } from '@angular/forms';
import { AuthModule } from '../welcome/auth.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule, CanActivate } from '@angular/router';

import { AuthGuard } from '../welcome/auth-guard.service';

import { DimeComponent } from './dime/dime.component';
import { DimemenuComponent } from './dimemenu/dimemenu.component';

import { DimeprocessesComponent } from './dimeprocess/dimeprocesses/dimeprocesses.component';
import { DimeschedulesComponent } from './dimeschedule/dimeschedules/dimeschedules.component';
import { DimeenvironmentsComponent } from './dimeenvironment/dimeenvironments/dimeenvironments.component';
import { DimestreamsComponent } from './dimestream/dimestreams/dimestreams.component';
import { DimemapsComponent } from './dimemap/dimemaps/dimemaps.component';
import { DimematricesComponent } from './dimematrix/dimematrices/dimematrices.component';

import { DimescheduleModule } from './dimeschedule/dimeschedule.module';
import { DimeprocessModule } from './dimeprocess/dimeprocess.module';
import { DimeenvironmentModule } from './dimeenvironment/dimeenvironment.module';
import { DimestreamModule } from './dimestream/dimestream.module';
import { DimemapModule } from './dimemap/dimemap.module';
import { DimematrixModule } from './dimematrix/dimematrix.module';

import { DimedashboardComponent } from './dimedashboard/dimedashboard.component';

const dimeRoutes: Routes = [
	{
		path: 'dime', component: DimeComponent, children: [
			{ path: '', component: DimedashboardComponent, canActivate: [AuthGuard] },
			{ path: 'schedules', component: DimeschedulesComponent, loadChildren: 'app/dime/dimeschedule/dimeschedule.module#DimescheduleModule' },
			{ path: 'processes', component: DimeprocessesComponent, loadChildren: 'app/dime/dimeprocess/dimeprocess.module#DimeprocessModule' },
			{ path: 'environments', component: DimeenvironmentsComponent, loadChildren: 'app/dime/dimeenvironment/dimeenvironment.module#DimeenvironmentModule' },
			{ path: 'streams', component: DimestreamsComponent, loadChildren: 'app/dime/dimestream/dimestream.module#DimestreamModule' },
			{ path: 'maps', component: DimemapsComponent, loadChildren: 'app/dime/dimemap/dimemap.module#DimemapModule' },
			{ path: 'matrices', component: DimematricesComponent, loadChildren: 'app/dime/dimematrix/dimematrix.module#DimematrixModule' }
		]
	}
];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		DimeprocessModule,
		DimescheduleModule,
		DimeenvironmentModule,
		DimestreamModule,
		DimemapModule,
		DimematrixModule,
		RouterModule.forChild(dimeRoutes),
		AuthModule
	],
	exports: [
		RouterModule
	],
	declarations: [
		DimeComponent,
		DimemenuComponent,
		DimedashboardComponent
	]
})
export class DimeModule { }
