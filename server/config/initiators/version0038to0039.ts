import { TableDefiner } from '../../../shared/model/mysql/mysql.table.def';
import { Pool } from 'mysql';
import { InitiatorUtils } from './initiatorUtils';

export class Version0038to0039 {
	utils: InitiatorUtils;

	constructor( private db: Pool, private configuration: any ) {
		this.utils = new InitiatorUtils( this.db, this.configuration );
	}

	public upgrade = ( currentVersion: number ) => {
		return new Promise( ( resolve, reject ) => {
			const expectedCurrentVersion = 38;
			const nextVersion = expectedCurrentVersion + 1;
			if ( currentVersion > expectedCurrentVersion ) {
				resolve( currentVersion );
			} else {
				const tableDef: TableDefiner = {
					name: 'taggroups',
					fields: ['id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT',
						'name varchar(1024) NOT NULL DEFAULT \'New Tag Group\'',
						'position INT UNSIGNED NOT NULL'
					],
					primaryKey: 'id',
					values: [{ name: 'First Tag Group', position: 0 }],
					fieldsToCheck: ['name']
				};


				resolve( this.utils.checkAndCreateTable( tableDef ).then( () => this.utils.updateToVersion( nextVersion ) ) );
			}
		} );
	}

}
