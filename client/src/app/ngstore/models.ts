import { Observable } from 'rxjs/Rx';
import {
	DimeMatrixAllLoadInitiateAction,
	DimeMatrixAllLoadInitiateIfEmptyAction,
	dimeMatrixInitialState,
	DimeMatrixOneLoadInitiateAction,
	dimeMatrixReducer,
	DimeMatrixState,
} from '../dime/dimematrix/dimematrix.ngrx';
import { dimeCredentialReducer, dimeCredentialInitialState, DimeCredentialState, DimeCredentialAllLoadInitiateIfEmptyAction, DimeCredentialOneLoadInitiateAction } from 'app/dime/dimecredential/dimecredential.ngrx';
import { dimeStreamReducer, DimeStreamState } from '../dime/dimestream/dimestream.ngrx';
import { dimeEnvironmentReducer, DimeEnvironmentState } from '../dime/dimeenvironment/dimeenvironment.ngrx';

import {
	DIME_ASYNC_PROCESS_ACTIONS,
	DimeAsyncProcessAllLoadInitiateAction,
	dimeAsyncProcessReducer,
	DimeAsyncProcessState,
} from '../dime/dimeasyncprocess/dimeasyncprocess.ngrx';
import { ActivatedRouteSnapshot } from '@angular/router';
import { RouterNavigationAction, ROUTER_NAVIGATION } from '@ngrx/router-store';
import { Actions, Effect } from '@ngrx/effects';
import { Injectable } from '@angular/core';
import { Action, State, Store } from '@ngrx/store';
import { of } from 'rxjs/observable/of';
import { DimeStatusState, dimeStatusInitialState, dimeStatusReducer } from 'app/ngstore/applicationstatus';
import { DimeTagState, dimeTagInitialState, dimeTagReducer, DimeTagAllLoadInitiateIfEmptyAction, DimeTagOneLoadInitiateAction } from 'app/dime/dimetag/dimetag.ngrx';

export interface RouteState { currentRoute: ActivatedRouteSnapshot }
export interface AppState {
	router: RouteState,
	dimeStatus: DimeStatusState,
	dimeTag: DimeTagState,
	dimeCredential: DimeCredentialState,
	dimeAsyncProcess: DimeAsyncProcessState,
	dimeEnvironment: DimeEnvironmentState,
	dimeStream: DimeStreamState,
	dimeMatrix: DimeMatrixState
}

export const appInitialState: AppState = {
	router: <RouteState>{},
	dimeStatus: dimeStatusInitialState,
	dimeTag: dimeTagInitialState,
	dimeCredential: dimeCredentialInitialState,
	dimeAsyncProcess: <DimeAsyncProcessState>{},
	dimeEnvironment: <DimeEnvironmentState>{},
	dimeStream: <DimeStreamState>{},
	dimeMatrix: dimeMatrixInitialState
}

export class DoNothingAction implements Action {
	readonly type = 'DONOTHINGATALL';
	constructor() { }
}

export class WarnUserAction implements Action {
	readonly type = 'WARN_USER';
	constructor( public payload?: string ) { }
}

export function dimeHandleApiError( error: Response | any ) {
	const body = error.json();
	console.error( body );
	return Observable.throw( body );
}

export function routeReducer( state: RouteState, action: RouterNavigationAction ): RouteState {
	switch ( action.type ) {
		case ROUTER_NAVIGATION: {
			if ( action.payload ) {
				return { currentRoute: Object.assign( {}, action.payload.routerState.root ) };
			} else {
				return state;
			}
		}
		default: {
			return state;
		}
	}
	// if ( action.type === ROUTER_NAVIGATION ) {
	// 	if ( action.payload ) {
	// 		return { currentRoute: Object.assign( {}, action.payload.routerState.root ) };
	// 	} else {
	// 		return state;
	// 	}
	// } else {
	// 	return state;
	// }
}

export const reducers = {
	router: routeReducer,
	dimeTag: dimeTagReducer,
	dimeStatus: dimeStatusReducer,
	dimeCredential: dimeCredentialReducer,
	dimeAsyncProcess: dimeAsyncProcessReducer,
	dimeEnvironment: dimeEnvironmentReducer,
	dimeStream: dimeStreamReducer,
	dimeMatrix: dimeMatrixReducer
}

@Injectable()
export class RouteEffects {
	@Effect() navigationHappened$ = this.actions$.ofType( ROUTER_NAVIGATION ).map( ( r: RouterNavigationAction ) => routeHandleNavigation( r ) );

	constructor( private actions$: Actions, private store: Store<State<AppState>> ) { }
}

function routeHandleNavigation( r: RouterNavigationAction ) {
	const segments: string[] = [];
	let paramset: any = { params: {}, qparams: {} };

	if ( r ) {
		if ( r.payload ) {
			if ( r.payload.routerState ) {
				if ( r.payload.routerState.root ) {
					paramset = disectNavigation( r.payload.routerState.root, segments );
				}
			}
		}
	}
	switch ( segments[0] ) {
		case 'welcome': {
			return new DoNothingAction();
		}
		case 'dime': {
			switch ( segments[1] ) {
				case 'tags': {
					switch ( segments[2] ) {
						case 'tag-list': {
							return new DimeTagAllLoadInitiateIfEmptyAction();
						}
						case 'tag-detail/:id': {
							return new DimeTagOneLoadInitiateAction( paramset.params.id );
						}
						default: {
							console.log( 'We are at tags default' );
							return new DoNothingAction();
						}
					}
				}
				case 'credentials': {
					switch ( segments[2] ) {
						case 'credential-list': {
							return new DimeCredentialAllLoadInitiateIfEmptyAction();
						}
						case 'credential-detail/:id': {
							return new DimeCredentialOneLoadInitiateAction( paramset.params.id );
						}
						default: {
							console.log( 'We are at credentials default' );
							return new DoNothingAction();
						}
					}
				}
				case 'processes': {
					console.log( 'We are at processes' );
					return new DoNothingAction();
				}
				case 'asyncprocesses': {
					switch ( segments[2] ) {
						case 'asyncprocess-list': {
							return new DimeAsyncProcessAllLoadInitiateAction();
						}
						default: {
							console.log( 'We are at async processes default' );
							return new DoNothingAction();
						}
					}
				}
				case 'matrices': {
					switch ( segments[2] ) {
						case 'matrix-list': {
							return new DimeMatrixAllLoadInitiateIfEmptyAction();
						}
						case 'matrix-detail/:id': {
							return new DimeMatrixOneLoadInitiateAction( paramset.params.id );
						}
						default: {
							console.log( 'We are at matrices default' );
							return new DoNothingAction();
						}
					}
				}
				default: {
					return new DoNothingAction();
				}
			}
		}
		default: {
			console.log( 'Falled back to default' );
			return new DoNothingAction();
		}
	}
}

function disectNavigation( r: ActivatedRouteSnapshot, segments: string[] ) {
	let route = r.root;
	let params: any = {};
	while ( route.firstChild ) {
		if ( route.firstChild.routeConfig.path && route.firstChild.routeConfig.path !== '' ) {
			segments.push( route.firstChild.routeConfig.path );
		}
		params = Object.assign( params, route.firstChild.params );
		route = route.firstChild;
	}
	return { params, qparams: route.queryParams };
}
