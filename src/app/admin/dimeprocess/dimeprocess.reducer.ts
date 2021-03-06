import * as _ from 'lodash';
import { Action } from '../../ngstore/ngrx.generators';
import { DimeProcess, DimeProcessStep, DimeProcessStatus } from '../../../../shared/model/dime/process';
import { SortByName, SortByPosition, SortByDateDesc } from '../../../../shared/utilities/utilityFunctions';
import { DimeProcessActions } from './dimeprocess.actions';
import { ATReadyStatus, IsPreparedPayload } from '../../../../shared/enums/generic/readiness';
import { DimeLog } from '../../../../shared/model/dime/log';
import { State, initialState } from './dimeprocess.state';

export function reducer( state: State = initialState(), action: Action<any> ): State {
	switch ( action.type ) {
		case DimeProcessActions.ALL.LOAD.COMPLETE.type: {
			return handleAllLoadComplete( state, action );
		}
		case DimeProcessActions.ONE.LOAD.COMPLETE.type: {
			return handleOneLoadComplete( state, action );
		}
		case DimeProcessActions.ONE.ISPREPARED.INITIATE.type: {
			return handleOneIsPreparedInitiate( state, action );
		}
		case DimeProcessActions.ONE.ISPREPARED.COMPLETE.type: {
			return handleOneIsPreparedComplete( state, action );
		}
		case DimeProcessActions.ONE.STEP.LOADALL.COMPLETE.type: {
			return handleOneStepLoadAllComplete( state, action );
		}
		case DimeProcessActions.ONE.DEFAULTTARGETS.LOAD.COMPLETE.type: {
			return handleOneDefaultTargetsLoadComplete( state, action );
		}
		case DimeProcessActions.ONE.FILTERS.LOAD.COMPLETE.type: {
			return handleOneFiltersLoadComplete( state, action );
		}
		case DimeProcessActions.ONE.FILTERSDATAFILE.LOAD.COMPLETE.type: {
			return handleOneFiltersDataFileLoadComplete( state, action );
		}
		case DimeProcessActions.ONE.CHECKLOG.COMPLETE.type: {
			return handleOneChecklogComplete( state, action );
		}
		default: {
			return state;
		}
	}
}

const handleAllLoadComplete = ( state: State = initialState(), action: Action<DimeProcess[]> ): State => {
	const newState: State = Object.assign( {}, state );
	newState.items = _.keyBy( action.payload, 'id' );
	newState.ids = action.payload.sort( SortByName ).map( process => process.id );
	return newState;
};
const handleOneLoadComplete = ( state: State, action: Action<DimeProcess> ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem = Object.assign( <DimeProcess>JSON.parse( JSON.stringify( initialState().curItem ) ), action.payload );
	return newState;
};
const handleOneIsPreparedInitiate = ( state: State, action: Action<number> ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem.isPrepared = ATReadyStatus.Checking;
	return newState;
};
const handleOneIsPreparedComplete = ( state: State, action: Action<IsPreparedPayload> ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem.isPrepared = action.payload.isPrepared;
	newState.curItem.issueList = action.payload.issueList;
	return newState;
};
const handleOneStepLoadAllComplete = ( state: State, action: Action<DimeProcessStep[]> ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem.steps = action.payload.sort( SortByPosition );
	return newState;
};
const handleOneDefaultTargetsLoadComplete = ( state: State, action: Action<any[]> ): State => {
	const newState = Object.assign( {}, state );
	newState.curItem.defaultTargets = {};
	action.payload.forEach( target => {
		newState.curItem.defaultTargets[target.field] = target.value;
	} );
	return newState;
};
const handleOneFiltersLoadComplete = ( state: State, action: Action<any[]> ): State => {
	const newState = Object.assign( {}, state );
	// With the below one, if a filter is erased id will be erased from here as well
	Object.keys( newState.curItem.filters ).forEach( item => {
		delete newState.curItem.filters[item].id;
	} );
	action.payload.forEach( filter => {
		newState.curItem.filters[filter.field] = filter;
	} );
	return newState;
};
const handleOneFiltersDataFileLoadComplete = ( state: State, action: Action<any[]> ): State => {
	const newState = Object.assign( {}, state );
	// With the below one, if a filter is erased id will be erased from here as well
	Object.keys( newState.curItem.filtersDataFile ).forEach( item => {
		delete newState.curItem.filtersDataFile[item].id;
	} );
	action.payload.forEach( filter => {
		newState.curItem.filtersDataFile[filter.field] = filter;
	} );
	return newState;
};
const handleOneChecklogComplete = ( state: State, action: Action<DimeLog> ): State => {
	const newState = Object.assign( {}, state );
	// newState.currentLog = action.payload.details
	// 	.split( '\n' )
	// 	.map( log => log.split( ':' ) )
	// 	.map( log => [log.splice( 0, 3 ).join( ':' ), log.join( ':' )] )
	// 	.map( log => ( { date: log[0], log: log[1] } ) )
	// 	.sort( SortByDateDesc )
	// 	.map( log => log.date + ':' + log.log )
	// 	.join( '\n' );
	newState.currentLog = action.payload.details.split( '\n' ).reverse().join( '\n' );
	if ( action.payload.start !== action.payload.end ) {
		newState.curItem.status = DimeProcessStatus.Ready;
	}
	return newState;
};
