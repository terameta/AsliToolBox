import { TableDefiner } from '../../../shared/model/mysql/mysql.table.def';
import { Pool } from 'mysql';

export class InitiatorUtils {
	constructor( private db: Pool, private configuration: any ) { }

	public doWeHaveTable = ( tableName: string ): Promise<number> => {
		return new Promise(( resolve, reject ) => {
			const q = 'SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = "' + this.configuration.mysql.db + '" AND TABLE_NAME = "' + tableName + '"';
			this.db.query( q, ( err, rows, fields ) => {
				if ( err ) {
					reject( err );
				} else {
					let doWe = 0;
					rows.filter(( curTuple: any ) => curTuple.TABLE_NAME === tableName ).map(() => doWe++ );
					resolve( doWe );
				}
			} );
		} );
	}

	public createTable = ( curTable: TableDefiner ) => {
		return new Promise(( resolve, reject ) => {
			console.log( '=== Creating Table:', curTable.name );

			let createQuery = 'CREATE TABLE ' + curTable.name + '(' + curTable.fields.join( ',' );
			if ( curTable.primaryKey ) { createQuery += ', PRIMARY KEY (' + curTable.primaryKey + ') '; }
			createQuery += ')';

			this.db.query( createQuery, ( err, rows, fields ) => {
				if ( err ) {
					reject( err );
				} else {
					console.log( '=== Created Table:', curTable.name );
					resolve( curTable );
				}
			} );
		} );
	}

	public checkAndCreateTable = ( curTable: TableDefiner ) => {
		return this.doWeHaveTable( curTable.name ).
			then( result => result > 0 ? Promise.resolve( curTable ) : this.createTable( curTable ) ).
			then( this.populateTable );
	}

	public populateTable = ( curTable: any ) => {
		return new Promise(( tResolve, tReject ) => {
			let query = '';
			let checker: any[] = [];
			let wherer: any[] = [];
			const promises: any[] = [];
			curTable.values.forEach(( curTuple: any ) => {
				promises.push( new Promise(( resolve, reject ) => {
					query = 'SELECT COUNT(*) AS RESULT FROM ' + curTable.name + ' WHERE ';
					checker = [];
					wherer = [];
					curTable.fieldsToCheck.forEach(( curField: any ) => {
						checker.push( curField );
						checker.push( curTuple[curField] );
						wherer.push( '?? = ?' );
					} );
					query += wherer.join( ' AND ' );
					this.db.query( query, checker, ( err, rows, fields ) => {
						if ( err ) {
							reject( err );
						} else if ( rows[0].RESULT === 0 ) {
							this.db.query( 'INSERT INTO ' + curTable.name + ' SET ?', curTuple, ( ierr, irows, ifields ) => {
								if ( ierr ) {
									reject( ierr );
								} else {
									console.log( '=== Inserted records for', curTable.name );
									resolve( curTable );
								}
							} );
						} else {
							resolve( curTable );
						}
					} );
				} ) );
			} );

			Promise.all( promises ).then(() => { tResolve( curTable ); } ).catch( tReject );
		} );
	}

	public updateToVersion = ( newVersion: number ) => {
		return new Promise(( resolve, reject ) => {
			this.db.query( 'UPDATE currentversion SET version = ?', newVersion, ( err, rows, fields ) => {
				if ( err ) {
					reject( err );
				} else {
					resolve( newVersion );
				}
			} );
		} );
	}
}
