import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { WelcomeComponent } from './welcome.component';
import { WelcomedashboardComponent } from './welcomedashboard/welcomedashboard.component';
import { SigninComponent } from './signin/signin.component';
import { SignupComponent } from './signup/signup.component';



const welcomeRoutes: Routes = [
	{
		path: 'welcome', component: WelcomeComponent, children: [
			{ path: '', component: WelcomedashboardComponent },
			{ path: 'signin', component: SigninComponent },
			{ path: 'signup', component: SignupComponent }
		]
	}
];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		RouterModule.forChild(welcomeRoutes)
	],
	exports: [
		RouterModule
	],
	declarations: [WelcomedashboardComponent, WelcomeComponent, SigninComponent, SignupComponent]
})
export class WelcomeModule { }
