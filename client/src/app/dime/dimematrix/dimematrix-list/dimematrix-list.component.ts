import { DimeStream } from '../../../../../../shared/model/dime/stream';
import { SortByName } from '../../../../../../shared/utilities/utilityFunctions';
import { DimeMatrix } from '../../../../../../shared/model/dime/matrix';
import { AppState } from '../../../ngstore/models';
import { Store } from '@ngrx/store';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs/Rx';
import * as _ from 'lodash';

import { DimeMatrixService } from '../dimematrix.service';
import { DimeMapService } from '../../dimemap/dimemap.service';

@Component( {
	selector: 'app-dimematrix-list',
	templateUrl: './dimematrix-list.component.html',
	styleUrls: ['./dimematrix-list.component.css']
} )
export class DimeMatrixListComponent implements OnInit, OnDestroy {

	constructor( public mainService: DimeMatrixService ) { }

	ngOnInit() {
	}

	ngOnDestroy() {
	}

}
