import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';

import { AuthService } from '../auth.service';

@Component({
	selector: 'app-signin',
	templateUrl: './signin.component.html',
	styleUrls: ['./signin.component.css']
})
export class SigninComponent implements OnInit {

	constructor(private authService: AuthService) { }

	ngOnInit() {
	}

	signIn(form: NgForm) {
		const email = form.value.email;
		const password = form.value.password;
		console.log("We are signing in");
		this.authService.signinUser(email, password).subscribe((result) => {
			console.log("Resulted", result);
		}, (error) => {
			console.log("Erred:", error);
		});
	}

}
