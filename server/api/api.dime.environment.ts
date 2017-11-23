import { Application, Router } from 'express';
import * as express from 'express';
import { Pool } from 'mysql';

import { MainTools } from '../tools/tools.main';
import { EnvironmentTools } from '../tools/tools.dime.environment';
import { Rester } from '../tools/tools.rester';

export class ApiDimeEnvironment {
	environment: EnvironmentTools;
	apiRoutes: express.Router;
	rester: Rester;

	constructor( public app: Application, public db: Pool, public tools: MainTools ) {
		this.environment = new EnvironmentTools( this.db, this.tools );
		this.apiRoutes = express.Router();
		this.rester = new Rester( tools );
		this.setRoutes();
		this.rester.restify( this.apiRoutes, this.environment );
		this.app.use( '/api/dime/environment', this.apiRoutes );
	}

	setRoutes() {
		this.apiRoutes.get( '/listTypes', ( req, res ) => { this.rester.respond( this.environment.listTypes, null, req, res ); } );
		this.apiRoutes.get( '/verify/:id', ( req, res ) => { this.rester.respond( this.environment.verify, req.params.id, req, res ); } );
		this.apiRoutes.get( '/listDatabases/:id', ( req, res ) => { this.rester.respond( this.environment.listDatabases, { id: req.params.id }, req, res ); } );
		this.apiRoutes.get( '/listTables/:id/:db', ( req, res ) => { this.rester.respond( this.environment.listTables, { id: req.params.id, database: req.params.db }, req, res ); } );
		this.apiRoutes.post( '/listProcedures/:id', ( req, res ) => { this.rester.respond( this.environment.listProcedures, req.body, req, res ); } );
		this.apiRoutes.post( '/listProcedureDetails/:id', ( req, res ) => { this.rester.respond( this.environment.listProcedureDetails, req.body, req, res ); } );
	}


}
