import { DimeMatrix, DimeMatrixRefreshPayload } from '../../shared/model/dime/matrix';
import * as async from 'async';
import { MainTools } from './tools.main';
import { Pool } from 'mysql';
import { ATReadyStatus, IsReadyPayload } from '../../shared/enums/generic/readiness';
import * as _ from 'lodash';
import { StreamTools } from './tools.dime.stream';
import { DimeStreamField } from '../../shared/model/dime/streamfield';

export class DimeMatrixTool {
	private streamTool: StreamTools;

	constructor( public db: Pool, public tools: MainTools ) {
		this.streamTool = new StreamTools( this.db, this.tools );
	}

	public getAll = (): Promise<DimeMatrix[]> => {
		return new Promise( ( resolve, reject ) => {
			this.db.query( 'SELECT * FROM matrices', ( err, rows, fields ) => {
				if ( err ) {
					reject( { error: err, message: 'Retrieving items has failed' } );
				} else {
					resolve( rows.map( this.prepareMatrixDetails ) );
				}
			} );
		} );
	}
	public create = ( sentItem?: DimeMatrix ) => {
		if ( sentItem ) { if ( sentItem.id ) { delete sentItem.id; } }
		const newItem = this.tools.isEmptyObject( sentItem ) ? { name: 'New Item (Please change name)', stream: 0 } : <any>sentItem;
		return new Promise( ( resolve, reject ) => {
			this.db.query( 'INSERT INTO matrices SET ?', newItem, function ( err, result, fields ) {
				if ( err ) {
					reject( { error: err, message: 'Failed to create a new item.' } );
				} else {
					resolve( { id: result.insertId } );
				}
			} );
		} );
	}
	public getOne = ( id: number ) => {
		return this.getMatrixDetails( <DimeMatrix>{ id: id } );
	}
	public getMatrixDetails = ( refObj: DimeMatrix ): Promise<DimeMatrix> => {
		return new Promise( ( resolve, reject ) => {
			this.db.query( 'SELECT * FROM matrices WHERE id = ?', refObj.id, ( err, rows, fields ) => {
				if ( err ) {
					reject( err );
				} else if ( rows.length !== 1 ) {
					reject( new Error( 'Wrong number of records@getMatrixDetails' ) );
				} else {
					resolve( this.prepareMatrixDetails( rows[0] ) );
				}
			} );
		} );
	}
	private prepareMatrixDetails = ( refObject: any ): DimeMatrix => {
		refObject.tags = JSON.parse( refObject.tags );
		refObject.fields = JSON.parse( refObject.fields );
		if ( !refObject.fields ) { refObject.fields = {}; }
		if ( !refObject.tags ) { refObject.tags = {}; }
		return Object.assign( <DimeMatrix>{}, refObject );
	}
	public update = ( refMatrix: DimeMatrix ) => {
		const item: any = Object.assign( {}, refMatrix );
		item.fields = JSON.stringify( item.fields );
		item.tags = JSON.stringify( item.tags );
		delete item.isReady;
		delete item.notReadyReason;
		return new Promise( ( resolve, reject ) => {
			this.db.query( 'UPDATE matrices SET ? WHERE id = ' + item.id, item, ( err, result, fields ) => {
				if ( err ) {
					reject( { error: err, message: 'Failed to update the item' } );
				} else {
					resolve( { item } );
				}
			} );
		} );
	}
	public delete = ( id: number ) => {
		return new Promise( ( resolve, reject ) => {
			this.db.query( 'DELETE FROM matrices WHERE id = ?', id, ( err, result, fields ) => {
				if ( err ) {
					reject( { error: err, message: 'Failed to delete the item' } );
				} else {
					resolve( { id: id } );
				}
			} );
		} );
	}
	public prepareTables = ( id: number ) => {
		return new Promise( ( resolve, reject ) => {
			let matrix: DimeMatrix;
			this.dropTables( id )
				.then( this.getOne )
				.then( ( resMatrix ) => {
					matrix = resMatrix;
					return this.streamTool.getOne( matrix.stream );
				} )
				.then( ( stream ) => {
					// console.log( stream );
					// console.log( matrix );
					const fieldsToMatrix = stream.fieldList.filter( field => matrix.fields[field.id] ).map( field => ( { id: field.id, name: field.name } ) );
					// console.log( fieldsToMatrix );
					let createQuery = '';
					createQuery += 'CREATE TABLE MATRIX' + id + '_MATRIXTBL (';
					createQuery += 'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, \n';
					createQuery += fieldsToMatrix.map( curField => curField.name + ' VARCHAR(1024)' ).join( ', \n' );
					createQuery += ', PRIMARY KEY (id) )';
					// console.log( createQuery );
					this.db.query( createQuery, ( err, result, fields ) => {
						if ( err ) {
							reject( err );
						} else {
							resolve( { result: 'OK' } );
						}
					} );
				} )
				.catch( reject );
		} );
	}
	// public prepareTables = ( id: number ) => {
	// 	return new Promise( ( resolve, reject ) => {
	// 		this.dropTables( id ).
	// 			then( this.getFields ).then( ( fieldList: DimeMatrixField[] ) => {
	// 				let createQuery: string; createQuery = '';
	// 				createQuery += 'CREATE TABLE MATRIX' + id + '_MATRIXTBL (';
	// 				createQuery += 'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ';
	// 				createQuery += fieldList.map( curField => curField.name + ' VARCHAR(1024)' ).join( ',' );
	// 				createQuery += ', PRIMARY KEY (id) )';
	// 				// console.log( fieldList );
	// 				console.log( createQuery );
	// 				this.db.query( createQuery, ( err, result, fields ) => {
	// 					if ( err ) {
	// 						reject( err );
	// 					} else {
	// 						resolve( { result: 'OK' } );
	// 					}
	// 				} );
	// 			} ).
	// 			catch( reject );
	// 	} );
	// }
	public isReady = ( id: number ): Promise<IsReadyPayload> => {
		return new Promise( ( resolve, reject ) => {
			this.getOne( id )
				.then( matrix => {
					if ( !matrix ) {
						resolve( { isready: ATReadyStatus.NotReady, issue: 'No matrix is found with the id: ' + id + '.' } );
					} else if ( !matrix.stream ) {
						resolve( { isready: ATReadyStatus.NotReady, issue: 'No stream is attached to the matrix.' } );
					} else if ( !matrix.fields ) {
						resolve( { isready: ATReadyStatus.NotReady, issue: 'No fields are assigned to the matrix.' } );
					} else if ( Object.keys( matrix.fields ).length === 0 ) {
						resolve( { isready: ATReadyStatus.NotReady, issue: 'No fields are assigned to the matrix.' } );
					} else if ( _.values( matrix.fields ).filter( value => value ).length === 0 ) {
						resolve( { isready: ATReadyStatus.NotReady, issue: 'No fields are assigned to the matrix.' } );
					} else {
						const systemDBName = this.tools.config.mysql.db;
						this.db.query( 'SELECT * FROM information_schema.tables WHERE table_schema = ? AND table_name LIKE ?', [systemDBName, 'MATRIX' + matrix.id + '_MATRIXTBL'], ( err, rows, fields ) => {
							if ( err ) {
								reject( err );
							} else {
								if ( rows.length === 0 ) {
									resolve( { isready: ATReadyStatus.NotReady, issue: 'Matrix table is not yet created.' } );
								} else {
									resolve( { isready: ATReadyStatus.Ready } );
								}
							}

						} );
					}
				} )
				.catch( reject );
		} );
	}
	public dropTables = ( id: number ) => {
		return new Promise( ( resolve, reject ) => {
			this.db.query( 'DROP TABLE IF EXISTS ??', 'MATRIX' + id + '_MATRIXTBL', ( err, result, fields ) => {
				if ( err ) {
					reject( err );
				} else {
					resolve( id );
				}
			} );
		} );
	}
	public saveMatrixTuple = ( refObj: { id: number, matrixEntry: any } ) => {
		return new Promise( ( resolve, reject ) => {
			console.log( refObj );
			let saveQuery: string; saveQuery = '';
			if ( refObj.matrixEntry.id ) {
				saveQuery += 'UPDATE MATRIX' + refObj.id + '_MATRIXTBL SET ? WHERE id=' + refObj.matrixEntry.id;
			} else {
				saveQuery += 'INSERT INTO MATRIX' + refObj.id + '_MATRIXTBL SET ?';
			}
			let saverFields: any; saverFields = {};
			Object.keys( refObj.matrixEntry ).forEach( ( curFieldName ) => {
				if ( curFieldName === 'id' ) {

				} else if ( curFieldName.substr( -5 ) === '_DESC' ) {

				} else if ( curFieldName === 'saveresult' ) {

				} else {
					saverFields[curFieldName] = refObj.matrixEntry[curFieldName];
				}
			} );
			this.db.query( saveQuery, saverFields, ( err, result, fields ) => {
				if ( err ) {
					reject( err );
				} else {
					resolve( result );
				}
			} );
			// console.log( refObj );
			// console.log( saveQuery );
			// console.log( saverFields );
			// reject( 'Not yet' );
		} );
	}
	public getMatrixTable = ( payload: DimeMatrixRefreshPayload ) => {
		return this.getMatrixTableAction( payload ).then( ( result ) => result.matrixData );
	}
	public getMatrixTableAction = ( payload: DimeMatrixRefreshPayload ): Promise<DimeMatrix> => {
		return new Promise( ( resolve, reject ) => {
			let matrix: DimeMatrix;
			let fields: DimeStreamField[];
			this.getOne( payload.id )
				.then( resMatrix => {
					matrix = resMatrix;
					return this.streamTool.retrieveFields( matrix.stream );
				} )
				.then( ( resFields: DimeStreamField[] ) => {
					fields = resFields.filter( field => matrix.fields[field.id] );
					const matrixTable = 'MATRIX' + payload.id + '_MATRIXTBL';
					let selectQuery: string;
					selectQuery = 'SELECT * FROM (\n';
					selectQuery += '\tSELECT \n\t\t' + matrixTable + '.id';
					fields.forEach( field => {
						const descTable = 'STREAM' + field.stream + '_DESCTBL' + field.id;
						selectQuery += ',\n\t\t';
						selectQuery += matrixTable + '.' + field.name;
						if ( field.isDescribed ) {
							selectQuery += ',\n\t\t';
							selectQuery += descTable + '.Description AS ' + field.name + '_DESC';
						}
					} );
					selectQuery += '\tFROM ' + matrixTable;
					fields.filter( field => field.isDescribed ).forEach( field => {
						const descTable = 'STREAM' + field.stream + '_DESCTBL' + field.id;
						selectQuery += '\n\tLEFT JOIN ' + descTable;
						selectQuery += ' ON ' + descTable + '.RefField = ' + matrixTable + '.' + field.name;
					} );
					selectQuery += '\n) AS FSQMATRIXDESCRIBED';
					const wherers: string[] = [];
					const wherevals: any[] = [];
					if ( payload.filters ) {
						payload.filters.forEach( filter => {
							if ( filter.value ) {
								switch ( filter.type ) {
									case 'is': {
										if ( filter.isDescribed ) {
											wherers.push( '(' + filter.name + ' = ? OR ' + filter.name + '_DESC = ?)' );
											wherevals.push( filter.value );
											wherevals.push( filter.value );
										} else {
											wherers.push( filter.name + ' = ?' );
											wherevals.push( filter.value );
										}
										break;
									}
									case 'co': {
										if ( filter.isDescribed ) {
											wherers.push( '(' + filter.name + ' LIKE ? OR ' + filter.name + '_DESC LIKE ?)' );
											wherevals.push( filter.value );
											wherevals.push( filter.value );
										} else {
											wherers.push( filter.name + ' LIKE ?' );
											wherevals.push( '%' + filter.value + '%' );
										}
										break;
									}
									case 'bw': {
										if ( filter.isDescribed ) {
											wherers.push( '(' + filter.name + ' LIKE ? OR ' + filter.name + '_DESC LIKE ?)' );
											wherevals.push( filter.value );
											wherevals.push( filter.value );
										} else {
											wherers.push( filter.name + ' LIKE ?' );
											wherevals.push( filter.value + '%' );
										}
										break;
									}
									case 'ew': {
										if ( filter.isDescribed ) {
											wherers.push( '(' + filter.name + ' LIKE ? OR ' + filter.name + '_DESC LIKE ?)' );
											wherevals.push( filter.value );
											wherevals.push( filter.value );
										} else {
											wherers.push( filter.name + ' LIKE ?' );
											wherevals.push( '%' + filter.value );
										}
										break;
									}
								}
							}
						} );
					}
					if ( wherers.length > 0 ) {
						selectQuery += ' \nWHERE\n\t';
						selectQuery += wherers.join( '\n\tAND ' );
					}
					if ( payload.sorters ) {
						if ( payload.sorters.length > 0 ) {
							selectQuery += ' \nORDER BY';
							selectQuery += payload.sorters
								.map( sorter => ( '\n\t' + sorter.name + ' ' + ( sorter.isAsc ? 'ASC' : 'DESC' ) ) )
								.join( ', ' );
						}
					}
					this.db.query( selectQuery, wherevals, ( err, rows, resfields ) => {
						if ( err ) {
							reject( err );
						} else {
							matrix.matrixData = rows;
							resolve( matrix );
						}
					} );
				} );
		} );
	}
}
