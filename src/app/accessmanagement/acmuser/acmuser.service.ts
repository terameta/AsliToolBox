import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
// import { AuthHttp } from 'angular2-jwt';
// import { Headers, Http } from '@angular/http';
import { BehaviorSubject } from 'rxjs';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { User } from '../../../../shared/models/user';

@Injectable( { providedIn: 'root' } )
export class AcmUserService {
	items: Observable<User[]>;
	private _items: BehaviorSubject<User[]>;
	private baseUrl: string;
	private dataStore: { items: User[] };
	private serviceName: string;

	curItem: User;
	curItemClean = true;
	curItemAccessRights: any;

	constructor(
		private http: HttpClient,
		// private authHttp: AuthHttp,
		private toastr: ToastrService,
		private router: Router,
		private route: ActivatedRoute,
	) {
		this.baseUrl = '/api/accessmanagement/user';
		this.serviceName = 'Users';
		this.dataStore = { items: [] };
		this._items = <BehaviorSubject<User[]>>new BehaviorSubject( [] );
		this.items = this._items.asObservable();

		this.resetCurItem();

		this.getAll( true );
	}

	public getAll = ( isSilent?: boolean ) => {
		this.fetchAll().subscribe( ( data: User[] ) => {
			this.dataStore.items = data;
			this._items.next( Object.assign( {}, this.dataStore ).items );
			if ( !isSilent ) { this.toastr.info( 'Items are loaded.', this.serviceName ); }
		}, ( error ) => {
			this.toastr.error( 'Failed to get items from server.', this.serviceName );
			console.log( error );
		} );
	}
	public fetchAll = () => {
		return this.http.get( this.baseUrl ).pipe( catchError( error => Observable.throw( error ) ) );
	}
	public create = () => {
		this.http.post<User>( this.baseUrl, {} )
			.subscribe( ( data ) => {
				this.dataStore.items.push( data );
				this._items.next( Object.assign( {}, this.dataStore ).items );
				this.resetCurItem();
				this.router.navigate( ['/accessmanagement/users/user-detail', data.id] );
				this.toastr.info( 'New item is created, navigating to the details', this.serviceName );
			}, ( error ) => {
				this.toastr.error( 'Failed to create new item.', this.serviceName );
				console.log( error );
			} );
	}
	public getOne = ( id: number ) => {
		this.fetchOne( id ).
			subscribe( ( data: User ) => {
				let notFound = true;

				this.dataStore.items.forEach( ( item, index ) => {
					if ( item.id === data.id ) {
						this.dataStore.items[index] = data;
						notFound = false;
					}
				} );

				if ( notFound ) {
					this.dataStore.items.push( data );
				}

				this._items.next( Object.assign( {}, this.dataStore ).items );
				this.curItem = data;
				this.curItemClean = true;
			}, ( error ) => {
				this.toastr.error( 'Failed to get the item.', this.serviceName );
				console.log( error );
			} );
		this.fetchUserRights( id ).
			subscribe( ( data ) => {
				this.curItemAccessRights = data;
			}, ( error ) => {
				this.toastr.error( 'Failed to get user access rights' );
				console.error( error );
			} );
	}
	public fetchOne = ( id: number ) => {
		return this.http.get( this.baseUrl + '/' + id ).pipe( catchError( error => Observable.throw( error ) ) );
	}
	public fetchUserRights = ( id: number ) => {
		return this.http.get( this.baseUrl + '/userrights/' + id ).pipe( catchError( error => Observable.throw( error ) ) );
	}
	public update = ( curItem?: User ) => {
		let shouldUpdate = false;
		if ( !curItem ) { curItem = this.curItem; shouldUpdate = true; }
		if ( curItem.type === 'directory' ) {
			curItem.username = curItem.email;
		}
		this.http.put<User>( this.baseUrl, curItem ).
			subscribe( data => {
				this.dataStore.items.forEach( ( item, index ) => {
					if ( item.id === data.id ) { this.dataStore.items[index] = data; }
				} );

				this._items.next( Object.assign( {}, this.dataStore ).items );
				this.toastr.info( 'Item is successfully saved.', this.serviceName );
				// If the update request came from another source, then it is an ad-hoc save of a non-current stream.
				// This shouldn't change the state of the current item.
				if ( shouldUpdate ) { this.curItemClean = true; }
			}, error => {
				this.toastr.error( 'Failed to save the item.', this.serviceName );
				console.log( error );
			} );
	}
	public updateAccessRights = () => {
		console.log( '===========================================' );
		console.log( '===========================================' );
		console.log( 'We will now save the access rights' );
		console.log( this.curItemAccessRights );
		console.log( '===========================================' );
		console.log( '===========================================' );
		this.http.put( this.baseUrl + '/userrights/' + this.curItem.id, this.curItemAccessRights ).
			subscribe( ( data ) => {
				console.log( data );
			}, ( error ) => {
				console.error( error );
			} );
	}
	public delete( id: number, name?: string ) {
		const verificationQuestion = this.serviceName + ': Are you sure you want to delete ' + ( name !== undefined ? name : 'the item' ) + '?';
		if ( confirm( verificationQuestion ) ) {
			this.http.delete( this.baseUrl + '/' + id ).subscribe( response => {
				this.dataStore.items.forEach( ( item, index ) => {
					if ( item.id === id ) { this.dataStore.items.splice( index, 1 ); }
				} );

				this._items.next( Object.assign( {}, this.dataStore ).items );
				this.toastr.info( 'Item is deleted.', this.serviceName );
				this.router.navigate( ['/accessmanagement/users/user-list'] );
				this.resetCurItem();
			}, ( error ) => {
				this.toastr.error( 'Failed to delete item.', this.serviceName );
				console.log( error );
			} );
		} else {
			this.toastr.info( 'Item deletion is cancelled.', this.serviceName );
		}
	}

	private resetCurItem = () => {
		this.curItem = <User>{};
		this.curItemClean = true;
		this.curItemAccessRights = {};
	}

}
