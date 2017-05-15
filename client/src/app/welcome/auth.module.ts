import { NgModule } from "@angular/core";
import { Http, RequestOptions } from "@angular/http";
import { AuthHttp, AuthConfig } from "angular2-jwt";

export function authHttpServiceFactory(http: Http, options: RequestOptions) {
	return new AuthHttp(new AuthConfig({
		headerName: "Authorization",
		headerPrefix: "bearer",
		tokenName: "token",
		tokenGetter: (() => localStorage.getItem("token")),
		// globalHeaders: [{ "Content-Type": "applicaton/json" }],
		noJwtError: true
	}), http, options);
}

@NgModule({
	providers: [
		{
			provide: AuthHttp,
			useFactory: authHttpServiceFactory,
			deps: [Http, RequestOptions]
		}
	]
})
export class AuthModule { }
