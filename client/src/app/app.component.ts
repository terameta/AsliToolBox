import { CourseDetail } from "./../../../src/shared/model/course-detail";
import { Observable } from "rxjs/Observable";
import { CoursesService } from "./services/courses.service";
import { Component, OnInit } from "@angular/core";

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit{

	course$: Observable<CourseDetail>;

	constructor(private coursesService: CoursesService) {

	}

	ngOnInit() {
		this.course$ = this.coursesService.loadCourseDetail(1);
	}
}
