import { AuthHttp, AuthConfig, AUTH_PROVIDERS, provideAuth } from "angular2-jwt";
import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { HttpModule } from "@angular/http";
import { Routes, RouterModule } from "@angular/router";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { ToastrModule } from "ngx-toastr";

import { AppComponent } from "./app.component";
import { DimeModule } from "./dime/dime.module";
import { WelcomeModule } from "./welcome/welcome.module";
import { AuthService } from "./welcome/auth.service";
import { AuthGuard } from "./welcome/auth-guard.service";
import { AuthModule } from "./welcome/auth.module";

// Services
import { DimeMapService } from "./dime/dimemap/dimemap.service";

const appRoutes: Routes = [
	// { path: '', component: AppComponent },
	{ path: "", pathMatch: "full", redirectTo: "welcome" }
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
		BrowserAnimationsModule,
		AuthModule
	],
	providers: [
		AuthGuard,
		AuthService,
		DimeMapService
	],
	bootstrap: [AppComponent]
})
export class AppModule { }
