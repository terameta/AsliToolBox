import { Action as NgRXAction } from '@ngrx/store';
import * as _ from 'lodash';

import { DimeStreamActions } from 'app/dime/dimestream/dimestream.actions';
import { DimeStreamState, dimeStreamInitialState } from 'app/dime/dimestream/dimestream.state';

export interface Action extends NgRXAction {
	payload?: any;
}

export function dimeStreamReducer( state: DimeStreamState, action: Action ): DimeStreamState {
	switch ( action.type ) {
		case DimeStreamActions.ALL.LOAD.COMPLETE: {
			return handleAllLoadComplete( state, action );
		}
		case DimeStreamActions.ONE.LOAD.COMPLETE: {
			return handleOneLoadComplete( state, action );
		}
		case DimeStreamActions.ONE.UNLOAD: {
			return handleOneUnload( state, action );
		}
		case DimeStreamActions.ONE.MARK.DIRTY: {
			return handleOneMarkDirty( state, action );
		}
		case DimeStreamActions.ONE.MARK.CLEAN: {
			return handleOneMarkClean( state, action );
		}
		case DimeStreamActions.ONE.DATABASELIST.SET: {
			return handleOneDatabaseListSet( state, action );
		}
		case DimeStreamActions.ONE.DATABASELIST.CLEAN: {
			return handleOneDatabaseListClean( state, action );
		}
		case DimeStreamActions.ONE.TABLELIST.SET: {
			return handleOneTableListSet( state, action );
		}
		case DimeStreamActions.ONE.TABLELIST.CLEAN: {
			return handleOneTableListClean( state, action );
		}
		case DimeStreamActions.ONE.FIELDS.LIST.FROMSOURCEENVIRONMENT.COMPLETE: {
			return handleOneFieldsListFromSourceEnvironmentComplete( state, action );
		}
		default: {
			return state;
		}
	}
}

const handleAllLoadComplete = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.items = _.keyBy( action.payload, 'id' );
	return newState;
}

const handleOneLoadComplete = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.curItem = action.payload;
	newState.curItemClean = true;
	return newState;
}

const handleOneUnload = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.curItem = dimeStreamInitialState.curItem;
	return newState;
}

const handleOneMarkDirty = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.curItemClean = false;
	return newState;
}

const handleOneMarkClean = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.curItemClean = true;
	return newState;
}

const handleOneDatabaseListSet = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.curItem.databaseList = action.payload;
	return newState;
}

const handleOneDatabaseListClean = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.curItem.databaseList = [];
	return newState;
}

const handleOneTableListSet = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.curItem.tableList = action.payload;
	return newState;
}

const handleOneTableListClean = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.curItem.tableList = [];
	return newState;
}

const handleOneFieldsListFromSourceEnvironmentComplete = ( state: DimeStreamState, action: Action ): DimeStreamState => {
	const newState: DimeStreamState = Object.assign( {}, state );
	newState.curItem.fieldList = action.payload;
	return newState;
}
