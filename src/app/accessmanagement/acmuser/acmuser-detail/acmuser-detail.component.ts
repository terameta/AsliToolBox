import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs/Subscription';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Component, OnDestroy, OnInit } from '@angular/core';

import { AuthService } from '../../../welcome/auth.service';

import { DimeProcessService } from '../../../dime/dimeprocess/dimeprocess.service';

import { AcmUserService } from '../acmuser.service';
import { AcmServerService } from '../../acmserver/acmserver.service';

@Component( {
	selector: 'app-acmuser-detail',
	templateUrl: './acmuser-detail.component.html',
	styleUrls: ['./acmuser-detail.component.css']
} )
export class AcmUserDetailComponent implements OnInit, OnDestroy {
	paramsSubscription: Subscription;
	assignedProcesses: any[];

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		public mainService: AcmUserService,
		public serverService: AcmServerService,
		public dimeProcessService: DimeProcessService,
		private toastr: ToastrService
	) { }

	ngOnInit() {
		this.paramsSubscription = this.route.params.subscribe(
			( params: Params ) => {
				this.mainService.getOne( params['id'] );
			}
		);
		// this.dimeProcessService.getAll();
		// this.dimeProcessService.fetchAll().subscribe(() => {
		// 	this.assignedProcesses = [];
		// 	this.dimeProcessService.items.forEach(( curProcessList ) => {
		// 		curProcessList.forEach(( curProcess ) => {
		// 			console.log( curProcess );
		// 			let toPush: any; toPush = {};
		// 			toPush.id = curProcess.id;
		// 			toPush.name = curProcess.name;
		// 			toPush.isAssigned = false;
		// 			this.assignedProcesses.push( toPush );
		// 		} );
		// 	} );
		// 	this.populateAccessRights();
		// }, ( error ) => {
		// 	this.toastr.error( 'Failed to receive processes' );
		// } );
	}

	ngOnDestroy() {
		this.paramsSubscription.unsubscribe();
	}

	public onEmailChange = () => {
		if ( this.mainService.curItem.type === 'directory' ) {
			this.mainService.curItem.username = this.mainService.curItem.email;
		}
	}
	private populateAccessRights = () => {
		if ( Object.keys( this.mainService.curItemAccessRights ).length === 0 ) {
			setTimeout( this.populateAccessRights, 1000 );
		} else {
			this.mainService.curItemAccessRights.processes.forEach( ( curProcess ) => {
				this.assignedProcesses.forEach( ( curAssignedProcess ) => {
					curAssignedProcess.user = this.mainService.curItem.id;
					console.log( curProcess.id, curProcess );
					if ( curAssignedProcess.id === curProcess.process ) {
						curAssignedProcess.isAssigned = true;
					}
				} );
			} );
			this.assignedProcesses.forEach( ( curAssignedProcess ) => {
				curAssignedProcess.user = this.mainService.curItem.id;
			} );
		}
	}
	private processAccessRightChange = () => {
		this.mainService.curItemAccessRights.processes = [];
		this.assignedProcesses.forEach( ( curAssignedProcess ) => {
			if ( curAssignedProcess.isAssigned ) {
				this.mainService.curItemAccessRights.processes.push( { user: curAssignedProcess.user, process: curAssignedProcess.id } );
			}
		} );
	}
}
