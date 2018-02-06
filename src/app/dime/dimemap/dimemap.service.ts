import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { ToastrService } from 'ngx-toastr';
import { Store } from '@ngrx/store';
import * as _ from 'lodash';

import { DimeMap, DimeMapRefreshPayload } from '../../../../shared/model/dime/map';
import { SortByName, getFormattedDate } from '../../../../shared/utilities/utilityFunctions';
import { DimeMapActions } from './dimemap.actions';
import { DimeMapBackend } from './dimemap.backend';
import { AppState } from '../../ngstore/models';

@Injectable()
export class DimeMapService {
	private serviceName = 'Streams';
	public itemList: DimeMap[];
	public itemObject: { [key: number]: DimeMap };
	public currentItem: DimeMap = <DimeMap>{};
	public currentItemClean: boolean;

	private filesToUpload: Array<File> = [];

	constructor(
		private toastr: ToastrService,
		private store: Store<AppState>,
		private router: Router,
		private backend: DimeMapBackend
	) {
		this.store.select( 'dimeMap' ).subscribe( mapState => {
			this.itemList = _.values( mapState.items ).sort( SortByName );
			this.itemObject = mapState.items;
			this.currentItem = mapState.curItem;
			this.currentItemClean = mapState.curItemClean;
		} );
	}

	public create = () => this.store.dispatch( DimeMapActions.ONE.CREATE.initiate( <DimeMap>{} ) );
	public update = () => this.store.dispatch( DimeMapActions.ONE.UPDATE.initiate( this.currentItem ) );
	public delete = ( id: number, name?: string ) => {
		const verificationQuestion = this.serviceName + ': Are you sure you want to delete ' + ( name !== undefined ? name : 'the item' ) + '?';
		if ( confirm( verificationQuestion ) ) {
			this.store.dispatch( DimeMapActions.ONE.DELETE.initiate( id ) );
		}
	}
	public navigateTo = ( id: number ) => {
		delete this.currentItem.sourcefields;
		delete this.currentItem.targetfields;
		this.router.navigateByUrl( this.router.routerState.snapshot.url
			.split( '/' )
			.map( ( curPart, curIndex ) => ( curIndex === 4 ? id : curPart ) )	// This part replaces the stream ID to the target stream's ID
			.filter( ( curPart, curIndex ) => ( curIndex < 6 ) )						// If we are at the field descriptions part, this will take us to parent and companent will handle redirecting
			.join( '/' )
		);
	}
	public rePrepareTables = () => {
		const verificationQuestion = this.serviceName + ': Are you sure to reprepare the map tables for ' + this.currentItem.name + ', this will erase all the map entries assigned?';
		if ( confirm( verificationQuestion ) ) {
			this.prepareTables();
		}
	}
	public prepareTables = () => {
		this.backend.prepare( this.currentItem.id ).subscribe( ( result ) => {
			this.toastr.info( 'Map tables are successfully created.', this.serviceName );
			this.isReady();
		}, ( error ) => {
			this.toastr.error( 'Failed to prepare the map tables.', this.serviceName );
			console.log( error );
		} );
	}
	public isReady = () => this.store.dispatch( DimeMapActions.ONE.ISREADY.initiate( this.currentItem.id ) );

	public mapExport = () => {
		this.backend.mapExport( this.currentItem.id )
			.subscribe( response => {
				this.mapExportDownload( response );
			}, error => {
				this.toastr.error( 'Failed to export the map. Please contact system administrator.' );
				console.error( error );
			} );
	}

	private mapExportDownload = ( response: any ) => {
		let blob: any; blob = new Blob( [response], { type: 'application/vnd.ms-excel' } );
		const url = window.URL.createObjectURL( blob, { oneTimeOnly: true } );
		const a = document.createElement( 'a' );
		a.href = url;
		a.download = this.currentItem.name + ' ' + getFormattedDate() + '.xlsx';
		window.document.body.appendChild( a );
		a.click();
		window.document.body.removeChild( a );
		window.URL.revokeObjectURL( url );
	}

	public mapImport = () => {
		let formData: FormData; formData = new FormData();
		const files: Array<File> = this.filesToUpload;

		formData.append( 'uploads[]', files[0], files[0].name );
		formData.append( 'id', this.currentItem.id.toString() );
		this.backend.mapImport( formData ).subscribe(
			response => {
				this.toastr.info( 'Map is now updated.', this.serviceName );
			}, error => {
				this.toastr.error( 'Failed to import map.', this.serviceName );
			}
		);
	}
	public mapImportFileChangeEvent = ( fileInput: any ) => {
		this.filesToUpload = <Array<File>>fileInput.target.files;
	}
	public saveMapTuple = ( tuple ) => this.backend.saveMapTuple( { mapid: this.currentItem.id, tuple } );
	public deleteMapTuple = ( tupleid ) => this.backend.deleteMapTuple( { mapid: this.currentItem.id, tupleid } );

	/*



	items: Observable<DimeMap[]>;
	itemCount: Observable<number>;
	curItem: DimeMap;
	curItemIsReady: boolean;
	curItemFields: any[];
	curItemClean: boolean;
	curItemSourceStream: DimeStream;
	curItemSourceStreamFields: any[];
	curItemTargetStream: DimeStream;
	curItemTargetStreamFields: any[];
	curItemMapData: any[];
	curItemMapColumns: any[];
	curItemMapColHeaders: string[];
	curItemMapRowHeaders: string[];
	curItemMapReadyToShow: boolean;
	private serviceName: string;
	private _items: BehaviorSubject<DimeMap[]>;
	private baseUrl: string;
	private dataStore: {
		items: DimeMap[]
	};
	private headers = new Headers( { 'Content-Type': 'application/json' } );




	constructor(
		// private http: Http,
		private authHttp: AuthHttp,
		private toastr: ToastrService,
		private router: Router,
		private route: ActivatedRoute,
		private streamService: DimeStreamService
	) {
		this.baseUrl = '/api/dime/map';
		this.dataStore = { items: [] };
		this._items = <BehaviorSubject<DimeMap[]>>new BehaviorSubject( [] );
		this.items = this._items.asObservable();
		this.itemCount = this.items.count();
		this.serviceName = 'Maps';
		this.resetCurItem();
		this.getAll();
	}
		private getStreamDefinition = ( id: number, srctar: string ) => {
			this.streamService.fetchOne( id ).subscribe(( result ) => {
				if ( srctar === 'source' ) { this.curItemSourceStream = result; }
				if ( srctar === 'target' ) { this.curItemTargetStream = result; }
			}, ( error ) => {
				this.toastr.error( 'Failed to fetch stream definition.', this.serviceName );
				console.log( error );
			} );
			this.streamService.retrieveFieldsFetch( id ).subscribe(( result ) => {
				if ( srctar === 'source' ) { this.curItemSourceStreamFields = result; }
				if ( srctar === 'target' ) { this.curItemTargetStreamFields = result; }
				if ( !this.curItemFields ) { this.getFields(); }
			}, ( error ) => {
				this.toastr.error( 'Failed to fetch stream fields list.', this.serviceName );
				console.log( error );
			} )
		}
		public assignSourceFields = () => {
			let fieldsToAssign: string[];
			fieldsToAssign = [];
			this.curItemSourceStreamFields.forEach(( curField ) => {
				if ( curField.mappable ) { fieldsToAssign.push( curField.name ); }
			} );
			this.setFields( fieldsToAssign, 'source' );
		};
		public assignTargetFields = () => {
			let fieldsToAssign: string[];
			fieldsToAssign = [];
			this.curItemTargetStreamFields.forEach(( curField ) => {
				if ( curField.mappable ) { fieldsToAssign.push( curField.name ); }
			} );
			this.setFields( fieldsToAssign, 'target' );
		};
		private setFields = ( fields: string[], srctar: string ) => {
			if ( !fields ) {
				this.toastr.error( 'No fields are selected.', this.serviceName );
			} else if ( fields.length === 0 ) {
				this.toastr.error( 'No fields are selected.', this.serviceName );
			} else {
				const toSend = {
					map: this.curItem.id,
					type: srctar,
					list: fields
				};
				this.authHttp.post( this.baseUrl + '/fields/', toSend, { headers: this.headers } ).
					map( response => response.json() ).
					subscribe(( result ) => {
						this.toastr.info( 'Map field assignments completed.', this.serviceName );
					}, ( error ) => {
						this.toastr.error( 'Failed to assign fields.', this.serviceName );
						console.log( error );
					} );
			}
		};
		private getFields = ( id?: number ) => {
			if ( !id ) { id = this.curItem.id; }
			this.fetchFields( id ).
				subscribe(( result ) => {
					this.curItemFields = result;
					this.matchFields();
				}, ( error ) => {
					this.toastr.error( 'Failed to get map fields.', this.serviceName );
					console.log( error );
				} )
		};
		public fetchFields = ( id: number ) => {
			return this.authHttp.get( this.baseUrl + '/fields/' + id, { headers: this.headers } ).
				map( response => response.json() ).
				catch(( error ) => { return Observable.throw( new Error( error ) ); } );
		}
		private matchFields = () => {
			if ( this.curItemSourceStreamFields ) {
				this.curItemSourceStreamFields.forEach(( curField: { name: string, mappable: boolean } ) => {
					curField.mappable = false;
					this.curItemFields.forEach(( curMapField ) => {
						if ( curMapField.name === curField.name && curMapField.srctar === 'source' ) {
							curField.mappable = true;
						}
					} );
				} );
			}
			if ( this.curItemTargetStreamFields ) {
				this.curItemTargetStreamFields.forEach(( curField: { name: string, mappable: boolean } ) => {
					curField.mappable = false;
					this.curItemFields.forEach(( curMapField ) => {
						if ( curMapField.name === curField.name && curMapField.srctar === 'target' ) {
							curField.mappable = true;
						}
					} );
				} );
			}
		};



		public fetchMapTable = ( currentFilter?: any ) => {
			if ( !currentFilter ) {
				currentFilter = {};
			}
			return this.authHttp.
				post( this.baseUrl + '/mapData?i=' + new Date().getTime(), { id: this.curItem.id, filters: currentFilter } ).
				map( response => response.json() ).
				catch( error => Observable.throw( error ) );
		};
		*/
}
