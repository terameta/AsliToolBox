import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { DimeschedulesComponent } from './dimeschedules/dimeschedules.component';
import { DimescheduleListComponent } from './dimeschedule-list/dimeschedule-list.component';
import { DimescheduleComponent } from './dimeschedule/dimeschedule.component';
import { DimescheduleDetailComponent } from './dimeschedule-detail/dimeschedule-detail.component';
import { DimescheduleToolbarComponent } from './dimeschedule-toolbar/dimeschedule-toolbar.component';
import { DimescheduleDetailMaindefinitionsComponent } from './dimeschedule-detail/dimeschedule-detail-maindefinitions/dimeschedule-detail-maindefinitions.component';
import { DimescheduleDetailStepsComponent } from './dimeschedule-detail/dimeschedule-detail-steps/dimeschedule-detail-steps.component';
import { DimescheduleDetailHistoryComponent } from './dimeschedule-detail/dimeschedule-detail-history/dimeschedule-detail-history.component';
import { CentralModule } from '../../central/central.module';

const dimeScheduleRoutes: Routes = [
	{
		path: '', component: DimeschedulesComponent, children: [
			{ path: '', component: DimescheduleListComponent },
			{
				path: ':id', component: DimescheduleDetailComponent, children: [
					{ path: '', component: DimescheduleDetailMaindefinitionsComponent },
					{ path: 'steps', component: DimescheduleDetailStepsComponent },
					{ path: 'history', component: DimescheduleDetailHistoryComponent }
				]
			}]
	},
];

@NgModule( {
	imports: [
		CommonModule,
		FormsModule,
		RouterModule.forChild( dimeScheduleRoutes ),
		CentralModule
	],
	exports: [
		RouterModule
	],
	declarations: [
		DimeschedulesComponent,
		DimescheduleListComponent,
		DimescheduleComponent,
		DimescheduleDetailComponent,
		DimescheduleToolbarComponent,
		DimescheduleDetailMaindefinitionsComponent,
		DimescheduleDetailStepsComponent,
		DimescheduleDetailHistoryComponent
	]
} )
export class DimescheduleModule { }
