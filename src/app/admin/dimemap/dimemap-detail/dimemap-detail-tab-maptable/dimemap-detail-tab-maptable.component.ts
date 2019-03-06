import { Component, OnInit } from '@angular/core';

// import * as Handsontable from 'handsontable/dist/handsontable.full.js';
import { ToastrService } from 'ngx-toastr';

import { DimeStreamService } from '../../../dimestream/dimestream.service';
import { DimeMapService } from '../../../dimemap/dimemap.service';
import { Store } from '@ngrx/store';
import { DimeMapField, DimeMapFilterTuple } from '../../../../../../shared/model/dime/map';
import { DimeStatusActions } from '../../../../ngstore/applicationstatus';
import { ATReadyStatus } from '../../../../../../shared/enums/generic/readiness';
import { DimeMapActions } from '../../dimemap.actions';
import { HotTableRegisterer } from '@handsontable/angular';
import * as Handsontable from 'handsontable';
import { DimeMatrixService } from '../../../dimematrix/dimematrix.service';
import { DimeMatrixBackend } from '../../../dimematrix/dimematrix.backend';
import { SortByName } from '../../../../../../shared/utilities/utilityFunctions';
import { AppState } from '../../../../app.state';
// import * as Handsontable from 'handsontable/dist/handsontable.full.js';

@Component( {
	selector: 'app-dimemap-detail-tab-maptable',
	templateUrl: './dimemap-detail-tab-maptable.component.html',
	styleUrls: ['./dimemap-detail-tab-maptable.component.css']
} )
export class DimemapDetailTabMaptableComponent implements OnInit {
	public atReadyStatus = ATReadyStatus;

	public numberofRowsinMap: string;
	public hotTableHeight = 250;
	public currentItemID = 0;
	public sortersShown = false;
	public filters: DimeMapFilterTuple[] = [];
	public availableSorters = [];
	public activeSorters = [];

	public mapSettings;
	public mapColumns: any[] = [];
	public mapData: any[] = [{ id: 'Filter Type' }, { id: 'Filter' }];

	private matrixObject: { targets: string[], matrixData: string[] } = { targets: [], matrixData: [] };

	private instance = 'hotInstance';
	private hotInstance: any;
	private invalidRows: number[] = [];

	constructor(
		public mainService: DimeMapService,
		private toastr: ToastrService,
		private streamService: DimeStreamService,
		public matrixService: DimeMatrixService,
		private matrixBackend: DimeMatrixBackend,
		private store: Store<AppState>,
		private hotRegisterer: HotTableRegisterer
	) {
		this.numberofRowsinMap = 'Rows: initiating...';

		this.store.select( 'map' ).subscribe( currentState => {
			if ( currentState.curItem.id !== this.currentItemID ) {
				this.currentItemID = currentState.curItem.id;
				this.getReady();
			}
			if ( currentState.curItem ) {
				if ( currentState.curItem.mapData ) {
					if ( currentState.curItem.mapData[0] ) {
						Object.keys( currentState.curItem.mapData[0] ).forEach( key => {
							if ( key !== 'id' ) {
								if ( !this.mapData[0][key] ) {
									this.mapData[0][key] = 'Contains';
								}
							}
						} );
					}
				}
			}
			this.mapData = [this.mapData[0], this.mapData[1], ...currentState.curItem.mapData];
			this.numberofRowsinMap = 'Rows: ' + this.mapData.length;
			if ( currentState.curItem.isMapDataRefreshing ) {
				this.numberofRowsinMap = 'Please wait, refreshing the data...';
			}
			this.hotInstance = this.hotRegisterer.getInstance( this.instance );
		} );
	}

	ngOnInit() {
		this.windowResized();
		this.mapSettings = {
			licenseKey: 'non-commercial-and-evaluation',
			colHeaders: true,
			rowHeaders: false,
			stretchH: 'all',
			manualColumnResize: true,
			manualColumnMove: true,
			fixedRowsTop: 2,
			minSpareRows: 0,
			afterChange: this.hotAfterChange,
			afterValidate: this.hotAfterValidate,
			afterOnCellMouseDown: this.hotAfterOnCellMouseDown,
			cells: function ( row, col, prop ) {
				if ( row === 0 ) {
					// console.log( row, col, prop );
					if ( prop !== 'matrixresult' && prop !== 'saveresult' && prop !== 'id' ) {
						this.type = 'dropdown';
						this.source = ['Exact Match', 'Contains', 'Begins with', 'Ends with'];
						this.readOnly = false;
					} else if ( col > 0 ) {
						this.readOnly = true;
						this.type = 'text';
						this.renderer = ( instance, td, rrow, rcol, rprop, value, cellProperties ) => {
							td.innerHTML = '&nbsp;';
							td.className = 'htCenter';
						};
					} else {
						this.readOnly = true;
						this.type = 'text';
						this.renderer = ( instance, td, rrow, rcol, rprop, value, cellProperties ) => {
							td.innerHTML = '<i class="fa fa-filter fa-fw"></i>';
							td.className = 'htCenter';
						};
					}
				}
				if ( row === 1 ) {
					if ( prop !== 'matrixresult' && prop !== 'saveresult' && prop !== 'id' ) {
						this.type = 'text';
						this.readOnly = false;
					} else if ( col > 0 ) {
						this.readOnly = true;
						this.type = 'text';
						this.renderer = ( instance, td, rrow, rcol, rprop, value, cellProperties ) => {
							td.innerHTML = '&nbsp;';
							td.className = 'htCenter';
						};
					} else {
						this.readOnly = true;
						this.type = 'text';
						this.renderer = ( instance, td, rrow, rcol, rprop, value, cellProperties ) => {
							td.innerHTML = '<i class="fa fa-filter fa-fw"></i>';
							td.className = 'htCenter';
						};
					}
				}
			}
		};
	}
	private hotDeleteRenderer = ( instance, td, row, col, prop, value, cellProperties ) => {
		// console.log( 'Renderer is called', td, row, col, prop, value, cellProperties );
		td.innerHTML = '<i class="fa fa-trash fa-fw" style="color:red;cursor:pointer;" id="' + value + '"></i>';
		td.className = 'htCenter';
	}
	private hotEmptyRenderer = ( instance, td, row, col, prop, value, cellProperties ) => {
		console.log( 'Renderer is called', td, row, col, prop, value, cellProperties );
		td.innerHTML = '&nbsp;';
		td.className = 'htCenter';
	}
	private hotAfterOnCellMouseDown = ( instance, event, cords, td ) => {
		// console.log( core, event, cords, td );
		if ( event.realTarget.className.toString().indexOf( 'fa-trash' ) >= 0 ) {
			this.deleteTuple( event.realTarget.id );
		}
	}
	public deleteTuple = ( id: number ) => {
		setTimeout( () => {
			this.deleteTupleAction( id );
		}, 100 );
	}
	private deleteTupleAction = ( id: number ) => {
		const verificationQuestion = 'Are you sure you want to delete ' + id + '?';
		if ( confirm( verificationQuestion ) ) {
			this.mainService.deleteMapTuple( id ).subscribe( result => {
				this.toastr.success( 'Map entry is successfully deleted\nRefreshing the data table.' );
				this.refreshMapTable();
			}, error => {
				this.toastr.error( 'Map entry deletion failed:\n' + error.message );
				console.error( 'Map deletion failed' );
				console.error( error );
			} );
		} else {
			this.toastr.info( 'Map entry deletion is cancelled: ' + id );
		}
	}
	private hotAfterValidate = ( instance: any, isValid: boolean, value: any, row: number, prop: string | number, source: string ) => {
		if ( !isValid ) {
			if ( this.invalidRows.findIndex( element => element === row ) < 0 ) {
				this.invalidRows.push( row );
			}
		} else {
			const curIndex = this.invalidRows.findIndex( element => element === row );
			if ( curIndex >= 0 ) {
				this.invalidRows.splice( curIndex, 1 );
			}
		}
	}
	private hotAfterChange = ( instance: any, changes: any[], source: string ) => {
		if ( source !== 'loadData' && changes && Array.isArray( changes ) && changes.length > 0 ) {
			const didFilterChange = changes.filter( change => ( change[0] === 0 || change[0] === 1 ) ).length > 0;
			if ( didFilterChange ) {
				const oldFilters = JSON.stringify( this.filters );
				this.filters = [];
				Object.keys( this.mapData[0] ).filter( key => key !== 'id' ).forEach( key => {
					const toPush = <DimeMapFilterTuple>{};
					toPush.name = key;
					switch ( this.mapData[0][key] ) {
						case 'Contains': { toPush.type = 'co'; break; }
						case 'Exact Match': { toPush.type = 'is'; break; }
						case 'Begins with': { toPush.type = 'bw'; break; }
						case 'Ends with': { toPush.type = 'ew'; break; }
					}
					toPush.value = this.mapData[1][key];
					if ( toPush.name && toPush.type && toPush.value ) {
						this.filters.push( toPush );
					}
				} );
				this.filters.sort( SortByName );
				if ( oldFilters !== JSON.stringify( this.filters ) ) {
					this.refreshMapTable();
				}
			} else {
				let changedRowNumber, changedFieldName, changedOldValue, changedNewValue, changedDataIndex, changedDataID, changedDataTuple, isChangeValid;
				changes.forEach( currentChange => {
					changedRowNumber = currentChange[0];
					changedFieldName = currentChange[1];
					changedOldValue = currentChange[2];
					changedNewValue = currentChange[3].toString().split( '::' );
					// When we use the getDataAtRow, the first element in array is the ID.
					changedDataID = this.hotInstance.getDataAtRow( changedRowNumber )[0];
					changedDataIndex = this.mapData.findIndex( element => element.id === changedDataID );
					changedDataTuple = this.mapData[changedDataIndex];
					// console.log( this.hotInstance.getDataAtRow( changedRowNumber ) );
					// console.log( changedDataID, changedDataIndex );
					// console.log( source, changedFieldName, changedDataTuple[changedFieldName], changedOldValue, changedNewValue );
					changedDataTuple[changedFieldName] = changedNewValue[0];
					isChangeValid = ( this.invalidRows.findIndex( element => element === changedRowNumber ) < 0 );
					if ( isChangeValid ) {
						// Here we will attempt to show the description in the map table
						// This description part is only put under if the changed cell is valid.
						// This is because if the cell is not valid, we are not expecting a description to be found.
						// Also, while validating, we are already traversing the descriptions list and don't want to repeat it here and take a hit in the performance.
						if ( changedNewValue[1] ) {
							// If the user is typing or selecting from the dropdown, hotTable automatically provides the member name and description together
							// Since we are splitting the string with '::' and assigning it to changedNewValue array, if there is a second element in this array, this second element is the description
							changedDataTuple[changedFieldName + '_DESC'] = changedNewValue[1];
						} else {
							// If the user is copy/pasting from somewhere else or even within the hotTable
							// Description is not brought forward with the pasted cell.
							// In this case the changedNewValue array doesn't have a second element.
							// We should look for the description
							this.mainService.currentItem.targetfields
								.filter( currentMapField => ( 'TAR_' + currentMapField.name === changedFieldName ) )
								.forEach( ( currentMapField ) => {
									currentMapField.descriptions
										.filter( currentDescription => ( currentDescription.RefField === changedNewValue[0] ) )
										.forEach( currentDescription => {
											changedDataTuple[changedFieldName + '_DESC'] = currentDescription.Description;
										} );
								} );
						}


						const toCheck = this.matrixObject.targets.map( field => changedDataTuple['TAR_' + field] ).join( '|||' );
						const foundIndex = this.matrixObject.matrixData.findIndex( element => element === toCheck );
						let isValidAgainstMatrix = ( foundIndex >= 0 );
						if ( !this.mainService.currentItem.matrix ) {
							isValidAgainstMatrix = true;
						}
						if ( isValidAgainstMatrix ) {
							this.mapData[changedRowNumber].matrixresult = '<i class="fa fa-check-circle fa-fw" style="color:green;"></i>';
							this.mapData[changedRowNumber].saveresult = '<i class="fa fa-circle-o-notch fa-spin fa-fw" style="color:orange;"></i>';
							const toSave: any = Object.assign( {}, changedDataTuple );
							delete toSave.saveresult;
							delete toSave.matrixresult;
							Object.keys( toSave ).forEach( element => {
								if ( element.substr( -5 ) === '_DESC' ) {
									delete toSave[element];
								}
							} );
							this.saveMapTuple( toSave, changedRowNumber );
						} else {
							this.mapData[changedRowNumber].matrixresult = '<i class="fa fa-times fa-fw" style="color:red;"></i>';
						}
					} else {
						this.mapData[changedRowNumber].saveresult = '<i class="fa fa-exclamation-circle fa-fw" style="color:red;"></i>';
					}
				} );
				this.hotInstance.render();
				// // this.mainService.currentItem.sourcefields.forEach( curField => console.log( curField ) );
				// // this.mainService.currentItem.targetfields.forEach( curField => console.log( curField ) );
			}
		}
	}
	private saveMapTuple = ( toSave, changedRowNumber ) => {
		this.mainService.saveMapTuple( toSave ).subscribe( result => {
			let rowNumberToUpdate = -1;
			rowNumberToUpdate = changedRowNumber;
			this.mapData[changedRowNumber].saveresult = '<i class="fa fa-check-circle fa-fw" style="color:green;"></i>';
			this.hotInstance.render();
		}, error => {
			let rowNumberToUpdate = -1;
			rowNumberToUpdate = changedRowNumber;
			this.mapData[changedRowNumber].saveresult = '<i class="fa fa-times fa-fw" style="color:red;"></i>';
			this.hotInstance.render();
			console.error( 'Failed to save map:', toSave );
			console.error( error );
		} );
	}
	public windowResized = () => {
		this.hotTableHeight = window.innerHeight - 174;
		if ( this.hotTableHeight < 100 ) {
			this.hotTableHeight = 100;
		}
		// console.log( 'Window width:', window.innerWidth, 'Window Height:', window.innerHeight, 'Hot Table Height:', this.hotTableHeight );
	}
	public refreshMapTable = () => {
		this.sortersShown = false;
		this.numberofRowsinMap = 'Please wait, refreshing the data...';
		if ( this.mapData ) {
			this.mapData = [this.mapData[0], this.mapData[1]];
		} else {
			this.mapData = [{ id: 'Filter Type' }, { id: 'Filter' }];
		}
		this.store.dispatch( DimeMapActions.ONE.REFRESH.initiate( { id: this.mainService.currentItem.id, filters: this.filters, sorters: this.activeSorters } ) );
	}
	private getReady = () => {
		this.waitUntilItemIsReady()
			.then( this.prepareAvailableSorters )
			.then( this.prepareColumns )
			.then( this.prepareDescriptions )
			.then( this.prepareDropdowns )
			.then( this.prepareMatrix )
			.then( this.refreshMapTable )
			.catch( console.error );
	}
	private prepareMatrix = () => {
		return new Promise( ( resolve, reject ) => {
			if ( this.mainService.currentItem.matrix ) {
				this.matrixBackend.matrixRefresh( { id: this.mainService.currentItem.matrix, filters: [], sorters: [] } ).subscribe( ( result: any[] ) => {
					// const targets = this.mainService.currentItem.targetfields.map( field => field.name );
					this.matrixObject.targets = [];
					this.streamService.itemObject[this.mainService.currentItem.target].fieldList
						.filter( currentStreamField => ( this.mainService.currentItem.targetfields.findIndex( currentMapField => currentMapField.name === currentStreamField.name ) >= 0 ) )
						// Below ensures that there are no fields listed as target for matrix even if it is the target of the map where the matrix is using a subset of target fields of map
						// Before this fix, matrix would never validate
						.filter( currentStreamField => ( Object.keys( result[0] ).findIndex( key => key === currentStreamField.name ) >= 0 ) )
						.forEach( currentField => {
							this.matrixObject.targets.push( currentField.name );
						} );
					this.matrixObject.matrixData = result.map( tuple => {
						const toStructure: any[] = [];
						this.matrixObject.targets.forEach( field => {
							toStructure.push( tuple[field] );
						} );
						return toStructure.join( '|||' );
					} );
					resolve();
				}, error => {
					this.store.dispatch( DimeStatusActions.error( error, 'Matrices' ) );
					console.log( error );
					reject();
				} );
			} else {
				resolve();
			}
		} );
	}
	private prepareDropdowns = () => {
		return new Promise( ( resolve, reject ) => {
			this.streamService.itemObject[this.mainService.currentItem.target].fieldList.forEach( ( currentStreamField ) => {
				this.mainService.currentItem.targetfields.forEach( ( currentMapField ) => {
					if ( currentMapField.name === currentStreamField.name ) {
						let columnIndex: number;
						this.mapColumns
							.forEach( ( currentColumn, currentIndex ) => {
								if ( currentColumn.data === 'TAR_' + currentStreamField.name ) {
									columnIndex = currentIndex;
								}
							} );
						this.mapColumns[columnIndex].type = 'autocomplete';
						this.mapColumns[columnIndex].strict = true;
						this.mapColumns[columnIndex].allowInvalid = true;
						this.mapColumns[columnIndex].source = [];
						currentMapField.descriptions.forEach( ( currentDescription ) => {
							this.mapColumns[columnIndex].source.push( currentDescription.RefField + '::' + currentDescription.Description );
						} );
						this.mapColumns[columnIndex].validator = ( query, callback ) => {
							let isValid = false;
							if ( currentMapField.descriptions.findIndex( element => element.RefField === query ) >= 0 ) {
								isValid = true;
							}
							if ( currentMapField.descriptions.findIndex( element => element.RefField + '::' + element.Description === query ) >= 0 ) {
								isValid = true;
							}
							callback( isValid );
						};
					}
				} );
			} );
			resolve();
		} );
	}
	private prepareDescriptions = () => {
		return new Promise( ( resolve, reject ) => {
			const currentPrefix = '_TAR';
			const promises = [];
			this.streamService.itemObject[this.mainService.currentItem.target].fieldList.forEach( ( currentStreamField ) => {
				this.mainService.currentItem.targetfields.forEach( ( currentMapField ) => {
					if ( currentMapField.name === currentStreamField.name ) {
						promises.push( this.prepareDescriptionsAction( currentMapField, currentStreamField.stream, currentStreamField.id, currentPrefix ) );
					}
				} );
			} );
			Promise.all( promises ).then( resolve ).catch( reject );
		} );
	}
	private prepareDescriptionsAction = ( mapField: DimeMapField, stream: number, field: number, prefix: string ) => {
		return new Promise( ( resolve, reject ) => {
			this.streamService.fetchFieldDescriptions( stream, field ).subscribe( ( result: any[] ) => {
				mapField.descriptions = result;
				mapField.descriptions.push( { RefField: 'ignore', Description: 'ignore' } );
				mapField.descriptions.push( { RefField: 'missing', Description: 'missing' } );
				resolve();
			}, ( error ) => {
				reject( error );
			} );
		} );
	}
	private prepareColumns = () => {
		return new Promise( ( resolve, reject ) => {
			this.mapColumns = [];
			let currentColumn: any;
			let currentPrefix: string;
			this.mapColumns.push( { data: 'id', type: 'text', readOnly: true, title: 'ID' } );
			this.streamService.itemObject[this.mainService.currentItem.source].fieldList
				.filter( currentStreamField => ( this.mainService.currentItem.sourcefields.findIndex( currentMapField => currentMapField.name === currentStreamField.name ) >= 0 ) )
				.forEach( currentField => {
					currentColumn = {};
					currentPrefix = 'SRC_';
					currentColumn.data = currentPrefix + currentField.name;
					currentColumn.type = 'text';
					currentColumn.readOnly = true; 	// Because it is a source field, it is always read-only
					currentColumn.title = currentField.name;
					this.mapColumns.push( currentColumn );
					if ( currentField.isDescribed ) {
						currentColumn = {};
						currentColumn.data = currentPrefix + currentField.name + '_DESC';
						currentColumn.title = currentField.name + ' Description';
						currentColumn.type = 'text';
						currentColumn.readOnly = true;
						this.mapColumns.push( currentColumn );
					}
				} );
			this.streamService.itemObject[this.mainService.currentItem.target].fieldList
				.filter( currentStreamField => ( this.mainService.currentItem.targetfields.findIndex( currentMapField => currentMapField.name === currentStreamField.name ) >= 0 ) )
				.forEach( currentField => {
					currentColumn = {};
					currentPrefix = 'TAR_';
					currentColumn.data = currentPrefix + currentField.name;
					currentColumn.type = 'text';
					currentColumn.title = currentField.name;
					this.mapColumns.push( currentColumn );
					if ( currentField.isDescribed ) {
						currentColumn = {};
						currentColumn.data = currentPrefix + currentField.name + '_DESC';
						currentColumn.title = currentField.name + ' Description';
						currentColumn.type = 'text';
						currentColumn.readOnly = true;
						this.mapColumns.push( currentColumn );
					}
				} );
			if ( this.mainService.currentItem.matrix > 0 ) {
				this.mapColumns.push( { data: 'matrixresult', type: 'text', readOnly: true, renderer: 'html', title: '<i class="fa fa-th fa-fw" title="Matrix Result"></i>', className: 'htCenter' } );
			}
			this.mapColumns.push( { data: 'saveresult', type: 'text', readOnly: true, renderer: 'html', title: '<i class="fa fa-floppy-o fa-fw" title="Save Result"></i>', className: 'htCenter' } );
			this.mapColumns.push( { data: 'id', type: 'text', readOnly: true, renderer: this.hotDeleteRenderer, title: '<i class="fa fa-trash fa-fw" title="Click to Delete"></i>', className: 'htCenter' } );
			resolve();
		} );
	}
	private waitUntilItemIsReady = () => {
		return new Promise( ( resolve, reject ) => {
			if ( !this.mainService.currentItem
				|| !this.mainService.currentItem.sourcefields || this.mainService.currentItem.sourcefields.length === 0
				|| !this.streamService.itemObject[this.mainService.currentItem.source]
				|| !this.mainService.currentItem.targetfields || this.mainService.currentItem.targetfields.length === 0
				|| !this.streamService.itemObject[this.mainService.currentItem.target]
			) {
				setTimeout( () => { resolve( this.waitUntilItemIsReady() ); }, 300 );
			} else {
				resolve();
			}
		} );
	}
	private prepareAvailableSorters = () => {
		return new Promise( ( resolve, reject ) => {
			this.availableSorters = [];
			this.activeSorters = [];
			this.streamService.itemObject[this.mainService.currentItem.source].fieldList
				.filter( currentStreamField => ( this.mainService.currentItem.sourcefields.findIndex( currentMapField => currentMapField.name === currentStreamField.name ) >= 0 ) )
				.forEach( currentStreamField => {
					this.availableSorters.push( { name: currentStreamField.name, type: 'SRC', isAsc: true, label: 'Source ' + currentStreamField.name } );
				} );
			this.streamService.itemObject[this.mainService.currentItem.target].fieldList
				.filter( currentStreamField => ( this.mainService.currentItem.targetfields.findIndex( currentMapField => currentMapField.name === currentStreamField.name ) >= 0 ) )
				.forEach( currentStreamField => {
					this.availableSorters.push( { name: currentStreamField.name, type: 'TAR', isAsc: true, label: 'Target ' + currentStreamField.name } );
				} );
			resolve();
		} );
	}
	public addToActiveSorters = ( index: number ) => {
		this.activeSorters.push( this.availableSorters.splice( index, 1 )[0] );
	}
	public removeFromActiveSorters = ( index: number ) => {
		this.availableSorters.push( this.activeSorters.splice( index, 1 )[0] );
	}
	public swapActiveSorters = ( from: number, to: number ) => {
		const temp = this.activeSorters[to];
		this.activeSorters[to] = this.activeSorters[from];
		this.activeSorters[from] = temp;
	}
	private getMapTable = () => {
		this.numberofRowsinMap = 'Please wait, refreshing...';
		return new Promise( ( resolve, reject ) => {
			// let currentFilter: any;
			// if ( this.dataObject ) {
			// 	currentFilter = {};
			// 	Object.keys( this.dataObject[0] ).forEach( ( curKey ) => {
			// 		if ( this.dataObject[0][curKey] !== 'Filter Type' ) {
			// 			if ( this.dataObject[1][curKey] ) {
			// 				// console.log( curKey, this.dataObject[0][curKey], this.dataObject[1][curKey] );
			// 				currentFilter[curKey] = {
			// 					type: this.dataObject[0][curKey],
			// 					value: this.dataObject[1][curKey]
			// 				};
			// 			}
			// 		}
			// 	} );
			// } else {
			// 	currentFilter = {};
			// }
			// this.mainService.fetchMapTable( currentFilter ).subscribe( ( data ) => {
			// 	if ( this.dataObject ) {
			// 		this.dataObject = [this.dataObject[0], this.dataObject[1]];
			// 	} else {
			// 		this.dataObject = [{ id: 'Filter Type' }, { id: 'Filter' }];
			// 	}
			// 	// console.log( 'We received data' );
			// 	data.forEach( ( curData ) => {
			// 		this.dataObject.push( curData );
			// 		// console.log( curData );
			// 	} );
			// 	this.numberofRowsinMap = data.length + ' rows';
			// 	resolve();
			// }, ( error ) => {
			// 	reject( error );
			// } );
		} );
	}
	/*
		private getReady = () => {
			this.waitUntilItemIsReady().
				then( this.prepareColumnOrders ).
				then( this.defineHotItems ).
				then( this.getMapTable ).
				then( this.prepareColumns ).
				then( this.getDescriptions ).
				then( this.applyDescriptions ).
				then( this.prepareDropdowns ).
				then(() => {
					// console.log( 'We are ready, let\'s roll' );
					// console.log( this.dataObject );
					// console.log( this.columns );
					this.rowHeaders = [];
					this.dataObject.forEach(( curData ) => {
						this.rowHeaders.push( curData.id.toString() );
					} );
					this.hotSettings = {
						data: this.dataObject,
						observeChanges: true,
						columns: this.columns,
						fixedRowsTop: 2,
						stretchH: 'all',
						// width: 689,
						autoWrapRow: true,
						height: 441,
						// maxRows: 22,
						contextMenu: true,
						manualColumnResize: true,
						manualColumnMove: true,
						columnSorting: true,
						sortIndicator: true,
						rowHeaders: this.rowHeaders,
						rowHeaderWidth: 75,
						minSpareRows: 0,
						fillHandle: { direction: 'vertical', autoInsertRow: false },
						colHeaders: this.colHeaders,
						cells: function ( row, col, prop ) {
							if ( row === 0 ) {
								if ( prop !== 'saveresult' ) {
									this.type = 'dropdown';
									this.source = ['Exact Match', 'Contains', 'Begins with', 'Ends with'];
									this.readOnly = false;
								}
							}
							if ( row === 1 ) {
								if ( prop !== 'saveresult' ) {
									this.type = 'text';
									this.readOnly = false;
								}
							}
						},
						afterChange: this.hotAfterChange
					};
					this.hot = new Handsontable( this.hotElement, this.hotSettings );
					this.hot.updateSettings( {
						contextMenu: {
							items: {
								'row_above': {
									disabled: () => {
										// if filtertype or filter row, don't enable add row above
										return this.hot.getSelected()[0] === 0 || this.hot.getSelected()[0] === 1;
									}
								},
								'row_below': {
									disabled: () => {
										// if filtertype or filter row, don't enable add row above
										return this.hot.getSelected()[0] === 0 || this.hot.getSelected()[0] === 1;
									}
								},
								'remove_row': {
									disabled: () => {
										// if filtertype or filter row, don't enable add row above
										return this.hot.getSelected()[0] === 0 || this.hot.getSelected()[0] === 1;
									}
								}
							}
						}
					} );
				} ).
				catch(( issue ) => {
					console.log( issue );
					this.toastr.error( 'Map is not ready for data entry' );
				} );
		};


		private filterChange = () => {
			clearTimeout( this.filterChangeWaiter );
			this.filterChangeWaiter = setTimeout( this.filterChangeAction, 1000 );
		};
		private filterChangeAction = () => {
			this.getMapTable().then(() => {
				this.hot.loadData( this.dataObject );
			} );
		};
		private hotEdited = ( change: any ) => {
			let isSaveable = true;
			let toSubmit: any; toSubmit = { id: change.id };
			this.mainService.curItemFields.forEach(( curField ) => {
				if ( curField.srctar === 'target' ) {
					toSubmit['TAR_' + curField.name] = change['TAR_' + curField.name];
					if ( !change['TAR_' + curField.name] ) {
						isSaveable = false;
					} else {
						change['TAR_' + curField.name] = change['TAR_' + curField.name].toString().split( '::' )[0];
					}
				}
			} );
			if ( isSaveable ) {
				change.saveresult = '<center><i class="fa fa-circle-o-notch fa-spin"></i></center>';
				this.mainService.saveMapTuple( toSubmit ).subscribe(( result ) => {
					if ( result.insertId ) {
						change.id = result.insertId;
					}
					change.saveresult = '<center><i class="fa fa-check-circle" style="color:green;font-size:12px;"></i></center>';
					this.hot.loadData( this.dataObject );
				}, ( error ) => {
					change.saveresult = '<center><i class="fa fa-exclamation-circle" style="color:red;font-size:12px;"></i></center>';
					this.hot.loadData( this.dataObject );
					console.error( error );
				} );
			}
		};
		*/
}
