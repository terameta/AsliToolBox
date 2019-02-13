import { Action as NgRXAction } from '@ngrx/store';
import * as _ from 'lodash';
import { DimeMapActions } from './dimemap.actions';
import { ATReadyStatus } from '../../../../shared/enums/generic/readiness';
import { State, initialState } from './dimemap.state';

interface Action extends NgRXAction {
	payload?: any;
}

export function reducer( state: State = initialState(), action: Action ): State {
	switch ( action.type ) {
		case DimeMapActions.ALL.LOAD.COMPLETE: {
			return handleAllLoadComplete( state, action );
		}
		case DimeMapActions.ONE.LOAD.COMPLETE: {
			return handleOneLoadComplete( state, action );
		}
		case DimeMapActions.ONE.UNLOAD: {
			return handleOneUnload( state, action );
		}
		case DimeMapActions.ONE.MARK.DIRTY: {
			return handleOneMarkDirty( state, action );
		}
		case DimeMapActions.ONE.MARK.CLEAN: {
			return handleOneMarkClean( state, action );
		}
		case DimeMapActions.ONE.ISREADY.INITIATE: {
			return handleOneIsReadyInitiate( state, action );
		}
		case DimeMapActions.ONE.ISREADY.COMPLETE: {
			return handleOneIsReadyComplete( state, action );
		}
		case DimeMapActions.ONE.REFRESH.INITIATE: {
			return handleOneRefreshInitiate( state, action );
		}
		case DimeMapActions.ONE.REFRESH.COMPLETE: {
			return handleOneRefreshComplete( state, action );
		}
		default: {
			return state;
		}
	}
}

const handleAllLoadComplete = ( state: State, action: Action ): State => {
	const newState: State = Object.assign( {}, state );
	newState.items = _.keyBy( action.payload, 'id' );
	return newState;
};

const handleOneLoadComplete = ( state: State, action: Action ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem = Object.assign( initialState().curItem, action.payload );
	newState.curItemClean = true;
	return newState;
};

const handleOneUnload = ( state: State, action: Action ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem = initialState().curItem;
	return newState;
};

const handleOneMarkDirty = ( state: State, action: Action ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItemClean = false;
	return newState;
};

const handleOneMarkClean = ( state: State, action: Action ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItemClean = true;
	return newState;
};

const handleOneIsReadyInitiate = ( state: State, action: Action ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem.isready = ATReadyStatus.Checking;
	return newState;
};

const handleOneIsReadyComplete = ( state: State, action: Action ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem.isready = action.payload.isready;
	return newState;
};

const handleOneRefreshInitiate = ( state: State, action: Action ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem.mapData = [];
	newState.curItem.isMapDataRefreshing = true;
	return newState;
};

const handleOneRefreshComplete = ( state: State, action: Action ): State => {
	const newState: State = Object.assign( {}, state );
	newState.curItem.mapData = action.payload;
	newState.curItem.isMapDataRefreshing = false;
	return newState;
};
