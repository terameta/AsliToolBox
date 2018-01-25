import { AppState } from '../../ngstore/models';
import { Store } from '@ngrx/store';
import { SortByName, EnumToArray, SortByPosition } from '../../../../shared/utilities/utilityFunctions';
import { DimeStreamType, dimeGetStreamTypeDescription } from '../../../../shared/enums/dime/streamtypes';
import { ActivatedRoute, Router } from '@angular/router';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';

import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { ToastrService } from 'ngx-toastr';

import { DimeEnvironmentService } from '../dimeenvironment/dimeenvironment.service';
import { DimeStream, DimeStreamDetail } from '../../../../shared/model/dime/stream';
import { DimeStreamActions } from './dimestream.actions';
import { DimeStreamFieldDetail } from '../../../../shared/model/dime/streamfield';
import { DimeStreamBackend } from './dimestream.backend';

@Injectable()
export class DimeStreamService {
	private serviceName = 'Streams';

	public itemList: DimeStreamDetail[];
	public itemObject: { [key: number]: DimeStreamDetail };
	public currentItem: DimeStreamDetail;
	public currentItemClean: boolean;
	public typeList = EnumToArray( DimeStreamType );
	public typeObject = _.keyBy( this.typeList, 'value' );
	public getStreamTypeDescription = dimeGetStreamTypeDescription;

	constructor(
		private toastr: ToastrService,
		private store: Store<AppState>,
		private router: Router,
		private backend: DimeStreamBackend,
		private environmentService: DimeEnvironmentService
	) {
		this.store.select( 'dimeStream' ).subscribe( streamState => {
			this.itemList = _.values( streamState.items ).sort( SortByName );
			this.itemObject = streamState.items;
			this.currentItem = streamState.curItem;
			this.currentItemClean = streamState.curItemClean;
		} );
	}

	public create = () => {
		this.store.dispatch( DimeStreamActions.ONE.CREATE.initiate( <DimeStreamDetail>{} ) );
	}

	public update = () => {
		this.store.dispatch( DimeStreamActions.ONE.UPDATE.initiate( this.currentItem ) );
	}

	public delete = ( id: number, name?: string ) => {
		const verificationQuestion = this.serviceName + ': Are you sure you want to delete ' + ( name !== undefined ? name : 'the item' ) + '?';
		if ( confirm( verificationQuestion ) ) {
			this.store.dispatch( DimeStreamActions.ONE.DELETE.initiate( id ) );
		}
	}

	public prepareTables = () => {
		this.store.dispatch( DimeStreamActions.ONE.preparetables( this.currentItem.id ) );
	}

	public navigateTo = ( id: number ) => {
		delete this.currentItem.fieldList;
		this.router.navigateByUrl( this.router.routerState.snapshot.url
			.split( '/' )
			.map( ( curPart, curIndex ) => ( curIndex === 4 ? id : curPart ) )	// This part replaces the stream ID to the target stream's ID
			.filter( ( curPart, curIndex ) => ( curIndex < 6 ) )						// If we are at the field descriptions part, this will take us to parent and companent will handle redirecting
			.join( '/' )
		);
	}

	public doWeHaveDescribedFields = () => {
		if ( !this.currentItem ) {
			return false;
		} else if ( !this.currentItem.fieldList ) {
			return false;
		} else if ( this.currentItem.fieldList.length === 0 ) {
			return false;
		} else {
			return this.currentItem.fieldList.map( currentField => parseInt( ( currentField.isDescribed ? '1' : '0' ), 10 ) ).reduce( ( accumulator, currentItem ) => accumulator + currentItem ) > 0;
		}
	}

	public markDirty = () => {
		this.store.dispatch( DimeStreamActions.ONE.MARK.dirty() );
	}

	public refreshDatabases = () => {
		if ( !this.currentItemClean ) {
			this.toastr.error( 'Please save your changes before refreshing database list' );
			return false;
		}
		this.environmentService.listDatabases( this.currentItem.environment ).subscribe(
			( result: { name: string }[] ) => {
				this.toastr.info( 'Database list is updated', this.serviceName );
				this.store.dispatch( DimeStreamActions.ONE.DATABASELIST.set( result ) );
			}, ( error ) => {
				this.toastr.error( 'Failed to refresh databases.', this.serviceName );
				console.error( error );
			}
		);
	}

	public refreshTables = () => {
		if ( !this.currentItemClean ) {
			this.toastr.error( 'Please save your changes before refreshing the table list' );
			return false;
		}
		this.environmentService.listTables( this.currentItem.environment, this.currentItem.dbName ).subscribe(
			( result: { name: string, type: string }[] ) => {
				this.toastr.info( 'Table list is updated.', this.serviceName );
				this.store.dispatch( DimeStreamActions.ONE.TABLELIST.set( result ) );
			}, ( error ) => {
				this.toastr.error( 'Failed to refresh databases.', this.serviceName );
				console.error( error );
			}
		);
	}

	public assignCustomQuery = () => {
		this.currentItem.tableName = 'Custom Query';
		this.markDirty();
		this.update();
	}

	public fieldsListFromSourceEnvironment = ( id: number ) => {
		this.store.dispatch( DimeStreamActions.ONE.FIELDS.LIST.FROMSOURCEENVIRONMENT.initiate( id ) );
	}

	public fieldsStartOver = ( id?: number ) => {
		if ( !id ) { id = this.currentItem.id; }
		if ( confirm( 'Are you sure to delete all the assigned fields?' ) ) {
			this.store.dispatch( DimeStreamActions.ONE.FIELDS.STARTOVER.initiate( id ) );
		}
	}

	public fieldMove = ( theFieldList: any[], theField, direction ) => {
		const curOrder = theField.position;
		const nextOrder = parseInt( curOrder, 10 ) + ( direction === 'down' ? 1 : -1 );
		theFieldList.forEach( ( curField ) => {
			if ( parseInt( curField.position, 10 ) === nextOrder ) { curField.position = curOrder; }
		} );
		theField.position = nextOrder;
		theFieldList.sort( SortByPosition );
	}

	public isRDBT = () => this.currentItem.type === DimeStreamType.RDBT;
	public isHPDB = () => this.currentItem.type === DimeStreamType.HPDB;

	public fieldRefreshTables = ( field: DimeStreamFieldDetail ) => {
		if ( !field.descriptiveDB ) {
			this.toastr.error( 'Please assign a database to the field description before refreshing the table list' );
			return false;
		}
		this.environmentService.listDescriptiveTables( this.currentItem.environment, field.descriptiveDB, this.currentItem.tableName ).subscribe(
			( result: any[] ) => {
				this.toastr.info( 'Table list is updated' );
				field.descriptiveTableList = result;
				if ( !field.descriptiveTable && result && result.length > 0 ) { field.descriptiveTable = result[0].name; }
			}, ( error ) => {
				this.toastr.error( 'Failed to refresh table list.', this.serviceName );
				console.log( error );
			}
		);
	}

	public fieldListDescriptiveFields = ( field: DimeStreamFieldDetail ) => {
		this.backend.listFieldsforField( { environmentID: this.currentItem.environment, field } ).subscribe( result => {
			this.toastr.info( 'Descriptive fields are refreshed from the server for ' + field.name, this.serviceName );
			field.descriptiveFieldList = result;
		}, error => {
			this.toastr.error( 'Failed to refresh descriptive fields.', this.serviceName );
			console.error( 'fieldListDescriptiveFields:', error );
		} );
	}
	public fetchFieldDescriptions = ( stream: number, field: number ) => {
		return this.backend.fetchFieldDescriptions( { stream, field } );
	}
	public populateFieldDescriptions = () => {
		this.toastr.info( 'Please wait, refreshing the field descriptions from the source system', this.serviceName );
		this.backend.populateFieldDescriptions( this.currentItem.id ).subscribe( result => {
			this.toastr.info( 'Field descriptions are successfully pulled from the source system.', this.serviceName );
		}, error => {
			this.toastr.error( 'Failed to populate field descriptions.', this.serviceName );
			console.error( 'Populate Field Descriptions' );
			console.error( error );
		} );
	}

	// constructor(
	// 	private http: Http,
	// 	private authHttp: AuthHttp,
	// 	private toastr: ToastrService,
	// 	private router: Router,
	// 	private route: ActivatedRoute,
	// 	private environmentService: DimeEnvironmentService,
	// 	private store: Store<AppState>,
	// ) {
	// 	/*this.baseUrl = '/api/dime/stream';
	// 	this.serviceName = 'Streams';
	// 	this.dataStore = { items: [] };
	// 	this._items = <BehaviorSubject<DimeStream[]>>new BehaviorSubject( [] );
	// 	this.items = this._items.asObservable();
	// 	this.curItem = { id: 0, name: '-', type: 0, environment: 0 };
	// 	this.typeList = [];
	// 	this.getAll( true );
	// 	this.curItemEnvironmentType = '';
	// 	this.curItemAssignedFields = undefined;
	// 	this.curItemSourcedFields = undefined;

	// 	// Below is for transitioning to ngrx
	// 	this.store.select( 'dimeStream' ).subscribe( streamState => {
	// 		this.itemList = _.values( streamState.items ).sort( SortByName );
	// 		this.currentItem = streamState.curItem;
	// 	} );
	// 	*/
	// }
	/*

		/ **Reason to have fetchOne/getOne Couple
		 * Whenever there is a use of the service from another service, and the other service is requesting items, decoupling the fetching mechanism is beneficial.
		 * Please check dimemap.service.ts for the usage of fetchOne function * /
		getOne = ( id: number ) => {
			if ( this.typeList.length === 0 ) { this.listTypes(); }
			// this.authHttp.get(this.baseUrl + "/" + id).
			// 	map(response => response.json()).
			this.fetchOne( id ).
				subscribe( ( data ) => {
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
					this.setCurItemEnvironmentType();

					if ( this.curItem.dbName && this.curItemDatabaseList.length === 0 ) {
						this.curItemDatabaseList.push( { name: this.curItem.dbName } );
					}
					if ( this.curItemTableList.length === 0 ) {
						if ( this.curItem.tableName && this.curItem.tableName !== 'Custom Query' ) {
							this.curItemTableList.push( { name: this.curItem.tableName, type: '-' } );
						}
						this.curItemTableList.push( { name: 'Custom Query', type: 'Custom Query' } );
					}
					this.retrieveFields();
				}, ( error ) => {
					this.toastr.error( 'Failed to get the item.', this.serviceName );
					console.log( error );
				} );
		}


		private fieldSortNumeric = ( f1, f2 ): number => {
			let fItem: string;
			if ( f1.order ) { fItem = 'order' };
			if ( f1.fOrder ) { fItem = 'fOrder' };
			if ( f1.pOrder ) { fItem = 'pOrder' };
			if ( parseInt( f1[fItem], 10 ) > parseInt( f2[fItem], 10 ) ) {
				return 1;
			} else if ( parseInt( f1[fItem], 10 ) < parseInt( f2[fItem], 10 ) ) {
				return -1;
			} else {
				return 0;
			}
		}

		public assignFields = ( refObj: { id: number, fieldList: any[] } ) => {
			if ( !refObj ) {
				refObj = { id: 0, fieldList: [] };
				refObj.id = this.curItem.id;
				refObj.fieldList = this.curItemSourcedFields;
			}
			this.authHttp.post( this.baseUrl + '/assignFields/' + refObj.id, refObj.fieldList, { headers: this.headers } ).
				map( response => response.json() ).
				subscribe( ( data ) => {
					this.toastr.info( 'Stream fields are assigned.', this.serviceName );
					this.toastr.info( 'Refreshing the assigned fields.', this.serviceName );
					this.retrieveFields();
					this.curItemSourcedFields = undefined;
				}, ( error ) => {
					this.toastr.error( 'Failed to assign fields to the item.', this.serviceName );
					console.log( error );
				} );
		};
		public retrieveFieldsFetch = ( id: number ) => {
			return this.authHttp.get( this.baseUrl + '/retrieveFields/' + id ).
				map( response => response.json() ).
				catch( error => Observable.throw( error ) );
		}
		public retrieveFields = () => {
			this.retrieveFieldsFetch( this.curItem.id ).
				subscribe( ( data ) => {
					this.toastr.info( 'Stream assigned fields are retrieved.', this.serviceName );
					if ( data.length > 0 ) {
						this.curItemAssignedFields = data;
						this.curItemAssignedFields.forEach( ( curField ) => {
							if ( curField.isDescribed && curField.descriptiveDB && curField.descriptiveTable ) {
								if ( !this.descriptiveTables[curField.descriptiveDB] ) {
									this.descriptiveTables[curField.descriptiveDB] = [];
								}
								// this.descriptiveTables[curField.descriptiveDB].push({ name: curField.descriptiveTable, type: "-" }, { name: "Custom Query", type: "-" });
								if ( this.descriptiveTables[curField.descriptiveDB].indexOf( { name: curField.descriptiveTable, type: '-' } ) < 0 ) {
									this.descriptiveTables[curField.descriptiveDB].push( { name: curField.descriptiveTable, type: '-' } );
								}
								if ( this.descriptiveTables[curField.descriptiveDB].indexOf( { name: 'Custom Query', type: '-' } ) < 0 ) {
									this.descriptiveTables[curField.descriptiveDB].push( { name: 'Custom Query', type: '-' } );
								}

								if ( !this.descriptiveFields[curField.descriptiveDB] ) {
									this.descriptiveFields[curField.descriptiveDB] = {};
								}
								if ( !this.descriptiveFields[curField.descriptiveDB][curField.descriptiveTable] ) {
									this.descriptiveFields[curField.descriptiveDB][curField.descriptiveTable] = [];
									if ( curField.drfName ) { this.descriptiveFields[curField.descriptiveDB][curField.descriptiveTable].push( { name: curField.drfName, type: curField.drfType } ) };
									if ( curField.ddfName ) { this.descriptiveFields[curField.descriptiveDB][curField.descriptiveTable].push( { name: curField.ddfName, type: curField.ddfType } ) };
								}
							}
						} )
					}
				}, ( error ) => {
					this.toastr.error( 'Failed to retrieve assigned field list for the stream.', this.serviceName );
					console.log( error );
				} );
		}

		public fieldsSave = ( refObj: { id: number, fields: any[] } ) => {
			if ( !refObj ) {
				refObj = { id: 0, fields: [] };
				refObj.id = this.curItem.id;
				refObj.fields = this.curItemAssignedFields;
			}
			this.authHttp.post( this.baseUrl + '/saveFields', refObj, { headers: this.headers } ).
				map( response => response.json() ).
				subscribe( ( result ) => {
					this.toastr.info( 'Fields are saved.', this.serviceName );
					this.toastr.info( 'Refreshing field list.', this.serviceName );
					this.retrieveFields();
				}, ( error ) => {
					this.toastr.error( 'Failed to save fields.', this.serviceName );
					console.log( error );
				} );
		}
		public fieldsInitiateForPBCS = () => {
			this.curItemSourcedFields = [
				{ 'name': 'Account', 'type': 'Accounts', 'order': 1 },
				{ 'name': 'Period', 'type': 'Time', 'order': 2 },
				{ 'name': 'Year', 'type': 'Year', 'order': 3 },
				{ 'name': 'Scenario', 'type': 'Scenario', 'order': 4 },
				{ 'name': 'Version', 'type': 'Version', 'order': 5 },
				{ 'name': 'Entity', 'type': 'Entity', 'order': 6 }
			];
		}
		public fieldsAddtoPBCS = () => {
			this.curItemSourcedFields.push( { name: '', type: '', order: this.curItemSourcedFields.length + 1 } );
		}
		public fieldsRemoveFromPBCS = ( curIndex ) => {
			this.curItemSourcedFields.splice( curIndex, 1 );
			this.curItemSourcedFields.forEach( ( curField, curKey ) => {
				curField.order = curKey + 1;
			} );
		}
		public fetchFieldDescriptions = ( stream: number, field: number ) => {
			return this.authHttp.post( this.baseUrl + '/getFieldDescriptions', { stream: stream, field: field } ).
				map( response => response.json() ).
				catch( error => Observable.throw( error ) );
		};
		*/
}
