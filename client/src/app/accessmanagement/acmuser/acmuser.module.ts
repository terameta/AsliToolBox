import { AuthModule } from '../../welcome/auth.module';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AcmUserComponent } from './acmuser/acmuser.component';
import { AcmUsersComponent } from './acmusers/acmusers.component';
import { AcmUserListComponent } from './acmuser-list/acmuser-list.component';
import { AcmUserDetailComponent } from './acmuser-detail/acmuser-detail.component';
import { AcmUserToolbarComponent } from './acmuser-toolbar/acmuser-toolbar.component';

const acmServerRoutes: Routes = [
	{ path: 'accessmanagement/users', pathMatch: 'prefix', redirectTo: 'accessmanagement/users/user-list' },
	{ path: 'user-list', component: AcmUserListComponent },
	{ path: 'user-detail/:id', component: AcmUserDetailComponent }
]

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		RouterModule.forChild(acmServerRoutes),
		AuthModule
	],
	exports: [
		RouterModule
	],
	declarations: [
		AcmUserComponent,
		AcmUsersComponent,
		AcmUserListComponent,
		AcmUserDetailComponent,
		AcmUserToolbarComponent]
})
export class AcmUserModule { }
