import { ActivatedRoute, Router } from '@angular/router';
import { Injectable } from '@angular/core';
// import { Headers, Http, Response } from '@angular/http';

// import { AuthHttp } from 'angular2-jwt';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { ToastrService } from 'ngx-toastr';

import { EnumToArray, SortByName } from '../../../../shared/utilities/utilityFunctions';

import { DimeSchedule } from '../../../../shared/model/dime/schedule';
import { DimeScheduleStepType } from '../../../../shared/enums/dime/schedulesteptypes';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class DimeScheduleService {
	items: Observable<DimeSchedule[]>;
	curItem: DimeSchedule;
	private _items: BehaviorSubject<DimeSchedule[]>;
	private baseUrl: string;
	private dataStore: {
		items: DimeSchedule[]
	};
	private serviceName: string;
	private headers = new Headers( { 'Content-Type': 'application/json' } );

	constructor(
		private http: HttpClient,
		private toastr: ToastrService,
		private router: Router,
		private route: ActivatedRoute
	) {
		this.baseUrl = '/api/dime/schedule';
		this.dataStore = { items: [] };
		this._items = <BehaviorSubject<DimeSchedule[]>>new BehaviorSubject( [] );
		this.items = this._items.asObservable();
		this.serviceName = 'Schedules';
		this.resetCurItem();
	}

	private resetCurItem = () => {
		this.curItem = <DimeSchedule>{};
	}
	getAll = () => {
		this.fetchAll().
			subscribe( ( data ) => {
				data.sort( SortByName );
				this.dataStore.items = data;
				this._items.next( Object.assign( {}, this.dataStore ).items );
			}, ( error ) => {
				this.toastr.error( 'Failed to load items.', this.serviceName );
				console.log( error );
			} );
	}
	public fetchAll = () => {
		return this.http.get( this.baseUrl ).
			catch( error => Observable.throw( error ) );
	}
	getOne = ( id: number ) => {
		this.fetchOne( id ).
			subscribe( ( result ) => {
				let notFound = true;

				this.dataStore.items.forEach( ( item, index ) => {
					if ( item.id === result.id ) {
						this.dataStore.items[index] = result;
						notFound = false;
					}
				} );

				if ( notFound ) {
					this.dataStore.items.push( result );
				}

				this.dataStore.items.sort( SortByName );
				this._items.next( Object.assign( {}, this.dataStore ).items );
				this.curItem = result;
				// if ( this.curItem.status === null ) { this.curItem.status = 'ready'; }
				// if ( this.curItem.status !== 'ready' ) { this.checkLog( parseInt( this.curItem.status || '0', 10 ) ); }
				// this.curItemClean = true;
				// this.isPrepared( this.curItem.id );
				// this.stepGetAll( this.curItem.id );
				// this.fetchDefaultTargets( this.curItem.id );
				// this.fetchFilters( this.curItem.id );
			}, ( error ) => {
				this.toastr.error( 'Failed to get the item.', this.serviceName );
				console.log( error );
			} );
	}
	public fetchOne = ( id: number ) => {
		return this.http.get( this.baseUrl + '/' + id ).
			catch( error => Observable.throw( error ) );
	}
	create = () => {
		this.http.post<DimeSchedule>( this.baseUrl, {} ).
			subscribe( ( result ) => {
				this.dataStore.items.push( result );
				this.dataStore.items.sort( SortByName );
				this._items.next( Object.assign( {}, this.dataStore ).items );
				this.resetCurItem();
				this.router.navigate( ['/dime/schedules/schedule-detail', result.id] );
				this.toastr.info( 'New item is created, navigating to the details', this.serviceName );
			}, ( error ) => {
				this.toastr.error( 'Failed to create new item.', this.serviceName );
				console.log( error );
			}
			);
	}
	update = ( curItem?: DimeSchedule ) => {
		if ( !curItem ) {
			curItem = this.curItem;
		}
		this.http.put<DimeSchedule>( this.baseUrl, curItem ).
			subscribe( ( result ) => {
				this.dataStore.items.forEach( ( item, index ) => {
					if ( item.id === result.id ) { this.dataStore.items[index] = result; }
				} );
				this.dataStore.items.sort( SortByName );
				this._items.next( Object.assign( {}, this.dataStore ).items );
				this.toastr.info( 'Item is successfully saved.', this.serviceName );
			}, error => {
				this.toastr.error( 'Failed to save the item.', this.serviceName );
				console.log( error );
			} );
	}
	delete( id: number, name?: string ) {
		const verificationQuestion = this.serviceName + ': Are you sure you want to delete ' + ( name !== undefined ? name : 'the item' ) + '?';
		if ( confirm( verificationQuestion ) ) {
			this.http.delete( this.baseUrl + '/' + id ).subscribe( response => {
				this.dataStore.items.forEach( ( item, index ) => {
					if ( item.id === id ) { this.dataStore.items.splice( index, 1 ); }
				} );
				this.dataStore.items.sort( SortByName );
				this._items.next( Object.assign( {}, this.dataStore ).items );
				this.toastr.info( 'Item is deleted.', this.serviceName );
				this.router.navigate( ['/dime/schedules/schedule-list'] );
				this.resetCurItem();
			}, ( error ) => {
				this.toastr.error( 'Failed to delete item.', this.serviceName );
				console.log( error );
			} );
		} else {
			this.toastr.info( 'Item deletion is cancelled.', this.serviceName );
		}
	}
}
