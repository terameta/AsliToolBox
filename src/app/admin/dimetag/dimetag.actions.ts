import { Action as NgRXAction } from '@ngrx/store';
import { Tag } from '../../../../shared/model/dime/tag';
import { State, FEATURE } from './dimetag.state';

export interface Action extends NgRXAction {
	payload?: any;
}

export const DimeTagActions = {
	ALL: {
		LOAD: {
			INITIATE: 'DIME_TAG_ACTIONS_ALL_LOAD_INITIATE',
			initiate: (): Action => ( { type: DimeTagActions.ALL.LOAD.INITIATE } ),
			INITIATEIFEMPTY: 'DIME_TAG_ACTIONS_ALL_LOAD_INITIATE_IF_EMPTY',
			initiateifempty: (): Action => ( { type: DimeTagActions.ALL.LOAD.INITIATEIFEMPTY } ),
			COMPLETE: 'DIME_TAG_ACTIONS_ALL_LOAD_COMPLETE',
			complete: ( payload: Tag[] ): Action => ( { type: DimeTagActions.ALL.LOAD.COMPLETE, payload } )
		}
	},
	ONE: {
		LOAD: {
			INITIATE: 'DIME_TAG_ACTIONS_ONE_LOAD_INITIATE',
			initiate: ( payload: number ): Action => ( { type: DimeTagActions.ONE.LOAD.INITIATE, payload } ),
			COMPLETE: 'DIME_TAG_ACTIONS_ONE_LOAD_COMPLETE',
			complete: ( payload: Tag ): Action => ( { type: DimeTagActions.ONE.LOAD.COMPLETE, payload } )
		},
		CREATE: {
			INITIATE: 'DIME_TAG_ACTIONS_ONE_CREATE_INITIATE',
			initiate: ( payload: Tag ): Action => ( { type: DimeTagActions.ONE.CREATE.INITIATE, payload } ),
			COMPLETE: 'DIME_TAG_ACTIONS_ONE_CREATE_COMPLETE',
			complete: ( payload: Tag ): Action => ( { type: DimeTagActions.ONE.CREATE.COMPLETE, payload } )
		},
		UPDATE: {
			INITIATE: 'DIME_TAG_ACTIONS_ONE_UPDATE_INITIATE',
			initiate: ( payload: Tag ): Action => ( { type: DimeTagActions.ONE.UPDATE.INITIATE, payload } ),
			COMPLETE: 'DIME_TAG_ACTIONS_ONE_UPDATE_COMPLETE',
			complete: ( payload: Tag ): Action => ( { type: DimeTagActions.ONE.UPDATE.COMPLETE, payload } )
		},
		DELETE: {
			INITIATE: 'DIME_TAG_ACTIONS_ONE_DELETE_INITIATE',
			initiate: ( payload: number ): Action => ( { type: DimeTagActions.ONE.DELETE.INITIATE, payload } ),
			COMPLETE: 'DIME_TAG_ACTIONS_ONE_DELETE_COMPLETE',
			complete: (): Action => ( { type: DimeTagActions.ONE.DELETE.COMPLETE } )
		}
	}
};
