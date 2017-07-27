import { DimeScheduleService } from '../dimeschedule.service';
import { Component, OnInit } from '@angular/core';

@Component( {
	selector: 'app-dimeschedule-list',
	templateUrl: './dimeschedule-list.component.html',
	styleUrls: ['./dimeschedule-list.component.css']
} )
export class DimescheduleListComponent implements OnInit {

	constructor(
		private mainService: DimeScheduleService
	) {

	}

	ngOnInit() {
	}

}
