import { DimeEnvironment } from './environment';

export interface DimeEnvironmentDetail extends DimeEnvironment {
	database: string,
	table: string,
	connection: any,
	query: string,
	procedure: string,
	username: string,
	password: string
}
