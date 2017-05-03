import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { Routes, RouterModule } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { ToastrModule } from 'ngx-toastr';

import { AppComponent } from './app.component';
import { DimeModule } from './dime/dime.module';
import { WelcomeModule } from './welcome/welcome.module';

const appRoutes: Routes = [
	{ path: '', component: AppComponent }
];

@NgModule({
	declarations: [
		AppComponent
	],
	imports: [
		BrowserModule,
		FormsModule,
		HttpModule,
		WelcomeModule,
		DimeModule,
		RouterModule.forRoot(appRoutes),
		ToastrModule.forRoot(),
		BrowserAnimationsModule
	],
	providers: [],
	bootstrap: [AppComponent]
})
export class AppModule { }
