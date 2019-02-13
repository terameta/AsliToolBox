import { DimeScheduleService } from '../../dimeschedule.service';
import { Component, OnInit } from '@angular/core';
import { DimeTagService } from '../../../dimetag/dimetag.service';
import { ATStatusType } from '../../../../../../shared/enums/generic/statustypes';

@Component( {
	selector: 'app-dimeschedule-detail-maindefinitions',
	templateUrl: './dimeschedule-detail-maindefinitions.component.html',
	styleUrls: ['./dimeschedule-detail-maindefinitions.component.css']
} )
export class DimescheduleDetailMaindefinitionsComponent implements OnInit {
	public atStatusType = ATStatusType;

	constructor(
		public mainService: DimeScheduleService,
		public tagService: DimeTagService
	) { }

	ngOnInit() {
	}
	public addScheduleItem = () => {
		this.mainService.currentItem.schedule.push( { second: '*', minute: '*', hour: '*', dayofmonth: '*', month: '*', dayofweek: '*' } );
	}
	public deleteScheduleItem = ( id: number ) => {
		this.mainService.currentItem.schedule.splice( id, 1 );
	}
	private listSeconds = () => {
		let toReturn: { value: string, label: string }[]; toReturn = [{ value: '*', label: 'Every Second' }];
		let curLabel: string;
		for ( let i = 0; i < 60; i++ ) {
			curLabel = ( '0' + i ).substr( -2 );
			toReturn.push( { value: curLabel, label: curLabel } );
		}
		return toReturn;
	}
	private listMinutes = () => {
		let toReturn: { value: string, label: string }[]; toReturn = [{ value: '*', label: 'Every Minute' }];
		let curLabel: string;
		for ( let i = 0; i < 60; i++ ) {
			curLabel = ( '0' + i ).substr( -2 );
			toReturn.push( { value: curLabel, label: curLabel } );
		}
		return toReturn;
	}
	private listHours = () => {
		let toReturn: { value: string, label: string }[]; toReturn = [{ value: '*', label: 'Every Hour' }];
		let curLabel: string;
		for ( let i = 0; i < 24; i++ ) {
			curLabel = ( '0' + i ).substr( -2 );
			toReturn.push( { value: curLabel, label: curLabel } );
		}
		return toReturn;
	}
	private listDayofMonth = () => {
		let toReturn: { value: string, label: string }[]; toReturn = [{ value: '*', label: 'Every Day of Month' }];
		for ( let i = 1; i < 32; i++ ) {
			let curLabel: string; curLabel = '0';
			curLabel += i;
			curLabel = curLabel.substr( -2 );
			toReturn.push( { value: i.toString(), label: curLabel } );
		}
		return toReturn;
	}
	private listMonths = () => {
		let toReturn: { value: string, label: string }[]; toReturn = [{ value: '*', label: 'Every Month' }];
		toReturn.push( { value: '0', label: 'Jan' } );
		toReturn.push( { value: '1', label: 'Feb' } );
		toReturn.push( { value: '2', label: 'Mar' } );
		toReturn.push( { value: '3', label: 'Apr' } );
		toReturn.push( { value: '4', label: 'May' } );
		toReturn.push( { value: '5', label: 'Jun' } );
		toReturn.push( { value: '6', label: 'Jul' } );
		toReturn.push( { value: '7', label: 'Aug' } );
		toReturn.push( { value: '8', label: 'Sep' } );
		toReturn.push( { value: '9', label: 'Oct' } );
		toReturn.push( { value: '10', label: 'Nov' } );
		toReturn.push( { value: '11', label: 'Dec' } );
		return toReturn;
	}
	private listDayofWeek = () => {
		let toReturn: { value: string, label: string }[]; toReturn = [{ value: '*', label: 'Every Day of Week' }];
		toReturn.push( { value: '0', label: 'Sun' } );
		toReturn.push( { value: '1', label: 'Mon' } );
		toReturn.push( { value: '2', label: 'Tue' } );
		toReturn.push( { value: '3', label: 'Wed' } );
		toReturn.push( { value: '4', label: 'Thu' } );
		toReturn.push( { value: '5', label: 'Fri' } );
		toReturn.push( { value: '6', label: 'Sat' } );
		return toReturn;
	}
	public decideColWidth = ( numCols: number ) => {
		let colWidth = 12;
		if ( numCols > 0 ) {
			colWidth = Math.floor( colWidth / numCols );
		}
		if ( colWidth < 1 ) { colWidth = 1; }
		return colWidth;
	}
}
