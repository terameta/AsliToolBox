import { MainTools } from './tools.main';
import { Pool } from 'mysql';
import * as async from 'async';
import * as bcrypt from 'bcrypt';

import { AcmUser } from '../../shared/model/accessmanagement/user';

export class AcmUserTool {

	constructor( public db: Pool, public tools: MainTools ) {

	}

	public getAll = () => {
		return new Promise(( resolve, reject ) => {
			this.db.query( 'SELECT * FROM users', ( err, rows, fields ) => {
				if ( err ) {
					reject( { error: err, message: 'Retrieving access management user list has failed' } );
				} else {
					rows.forEach(( curRow: AcmUser ) => {
						delete curRow.password;
					} );
					resolve( rows );
				}
			} );
		} );
	};
	public create = ( sentItem?: AcmUser ) => {
		if ( sentItem ) { if ( sentItem.id ) { delete sentItem.id; } }
		const newItem = this.tools.isEmptyObject( sentItem ) ? { name: 'New User (Please change name)', username: '-', password: '-' } : <any>sentItem;
		return new Promise(( resolve, reject ) => {
			this.db.query( 'INSERT INTO users SET ?', newItem, function ( err, result, fields ) {
				if ( err ) {
					reject( { error: err, message: 'Failed to create a new item.' } );
				} else {
					resolve( { id: result.insertId } );
				}
			} );
		} );
	};
	public getOne = ( id: number ) => {
		return this.getUserDetails( <AcmUser>{ id: id } );
	};
	public getUserDetails = ( refObj: AcmUser ): Promise<AcmUser> => {
		return new Promise(( resolve, reject ) => {
			this.db.query( 'SELECT * FROM users WHERE id = ?', refObj.id, ( err, rows, fields ) => {
				if ( err ) {
					reject( { error: err, message: 'Retrieving item with id ' + refObj.id + ' has failed' } );
				} else if ( rows.length !== 1 ) {
					reject( { error: 'Wrong number of records', message: 'Wrong number of records for item received from the server, 1 expected' } );
				} else {
					delete rows[0].password;
					resolve( rows[0] );
				}
			} );
		} );
	}
	public getAccessRights = ( id: number ) => {
		return new Promise(( resolve, reject ) => {
			this.db.query( 'SELECT * FROM userdimeprocesses WHERE user = ?', id, ( err, rows, fields ) => {
				if ( err ) {
					reject( 'Failed to receive user access rights' );
				} else {
					let toResolve: any; toResolve = {};
					toResolve.processes = rows;
					resolve( toResolve );
				}
			} );
		} );
	};
	public setAccessRights = ( refObj: { user: number, rights: any } ) => {
		return new Promise(( resolve, reject ) => {
			this.clearAccessRights( refObj.user ).
				then(() => {
					return this.populateAccessRights( refObj.rights );
				} ).then( resolve ).catch( reject );
		} );
	};
	private clearAccessRights = ( id: number ) => {
		return new Promise(( resolve, reject ) => {
			const deleteQuery = 'DELETE FROM userdimeprocesses WHERE user = ?'
			this.db.query( deleteQuery, id, ( err, result, fields ) => {
				if ( err ) {
					reject( err );
				} else {
					resolve();
				}
			} );
		} );
	};
	private populateAccessRights = ( rights: { processes: any[] } ) => {
		return new Promise(( resolve, reject ) => {
			async.eachOfSeries(
				rights.processes,
				( item, key, callback ) => {
					this.db.query( 'INSERT INTO userdimeprocesses SET ?', item, ( err, result, fields ) => {
						if ( err ) {
							reject( err );
						} else {
							callback();
						}
					} );
				}, () => {
					resolve();
				}
			);
		} );
	};
	public update = ( item: AcmUser ) => {
		return new Promise(( resolve, reject ) => {
			if ( item.password === '|||---protected---|||' ) {
				delete item.password;
			} else if ( item.password ) {
				item.password = bcrypt.hashSync( item.password, 10 );
			}
			this.db.query( 'UPDATE users SET ? WHERE id = ' + item.id, item, function ( err, result, fields ) {
				if ( err ) {
					reject( { error: err, message: 'Failed to update the item' } );
				} else {
					delete item.password;
					resolve( { item } );
				}
			} );
		} );
	};
	public delete = ( id: number ) => {
		return new Promise(( resolve, reject ) => {
			this.db.query( 'DELETE FROM users WHERE id = ?', id, ( err, result, fields ) => {
				if ( err ) {
					reject( { error: err, message: 'Failed to delete the item' } );
				} else {
					resolve( { id: id } );
				}
			} );
		} );
	}
}
