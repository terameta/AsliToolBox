import { ATReadyStatus } from '../../enums/generic/readiness';
import { DimeFieldDescription } from './fielddescription';

export interface DimeMap {
	id: number,
	name: string,
	type: number,
	source: number,
	target: number,
	matrix: number,
	isready: ATReadyStatus,
	sourcefields: DimeMapField[],
	targetfields: DimeMapField[],
	isMapDataRefreshing: boolean,
	mapData: any[],
	tags: any
}

export interface DimeMapField {
	id: number,
	map: number,
	srctar: 'source' | 'target',
	name: string,
	descriptions: DimeFieldDescription[]
}

export interface DimeMapRefreshPayload {
	id: number,
	filters: DimeMapFilterTuple[],
	sorters: any
}

export interface DimeMapFilterTuple {
	name: string,
	type: 'is' | 'co' | 'bw' | 'ew',
	value: string
}
