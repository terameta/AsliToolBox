import { Injectable } from '@angular/core';
import { Effect, ofType, Actions } from '@ngrx/effects';
import { RouterActions, RouterGo } from './router.actions';
import { tap, pluck, map } from 'rxjs/operators';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ROUTER_NAVIGATED, RouterNavigatedAction } from '@ngrx/router-store';
import { DoNothingAction } from '../ngstore/models';
import { DimeTagGroupActions } from '../admin/dimetag/dimetaggroup.actions';
import { DimeTagActions } from '../admin/dimetag/dimetag.actions';
import { DimeSecretActions } from '../admin/dimesecret/dimesecret.actions';
import { DimeCredentialActions } from '../admin/dimecredential/dimecredential.actions';
import { DimeEnvironmentActions } from '../admin/dimeenvironment/dimeenvironment.actions';
import { DimeStreamActions } from '../admin/dimestream/dimestream.actions';
import { DimeMapActions } from '../admin/dimemap/dimemap.actions';
import { DimeProcessActions } from '../admin/dimeprocess/dimeprocess.actions';
import { DimeScheduleActions } from '../admin/dimeschedule/dimeschedule.actions';
import { DimeMatrixActions } from '../admin/dimematrix/dimematrix.actions';
import { DimeSettingsActions } from '../admin/dimesettings/dimesettings.actions';
import { DimeAsyncProcessAllLoadInitiateAction } from '../admin/dimeasyncprocess/asyncprocess.actions';
import { Store } from '@ngrx/store';
import { AppState } from '../app.state';

@Injectable()
export class Effects {

	@Effect( { dispatch: false } ) navigate$ = this.actions$.pipe(
		ofType( RouterActions.GO ),
		pluck( 'payload' ),
		tap( ( { path, query: queryParams, extras } ) => this.router.navigate( path, { queryParams, ...extras } ) )
	);

	@Effect( { dispatch: false } )
	navigateBack$ = this.actions$.pipe(
		ofType( RouterActions.BACK ),
		tap( () => this.location.back() )
	);

	@Effect( { dispatch: false } )
	navigateForward$ = this.actions$.pipe(
		ofType( RouterActions.FORWARD ),
		tap( () => this.location.forward() )
	);

	@Effect()
	defineSegments$ = this.actions$.pipe(
		ofType( ROUTER_NAVIGATED ),
		map( ( a: RouterNavigatedAction ) => a.payload.routerState.url ),
		map( ( url ) => {
			const segments = url.split( '/' ).splice( 1 );
			switch ( segments[0] ) {
				case 'admin': {
					switch ( segments[1] ) {
						case 'processes': {
							this.store.dispatch( DimeProcessActions.ALL.LOAD.INITIATEIFEMPTY.action() );
							if ( segments[2] ) this.store.dispatch( DimeProcessActions.ONE.LOAD.INITIATEIFEMPTY.action( parseInt( segments[2], 10 ) ) );
							return new DoNothingAction();
						}
						case 'schedules': {
							this.store.dispatch( DimeScheduleActions.ALL.LOAD.INITIATEIFEMPTY.action() );
							if ( segments[2] ) this.store.dispatch( DimeScheduleActions.ONE.LOAD.INITIATEIFEMPTY.action( parseInt( segments[2], 10 ) ) );
							return new DoNothingAction();
						}
						case 'matrices': {
							this.store.dispatch( DimeMatrixActions.ALL.LOAD.INITIATEIFEMPTY.action() );
							if ( segments[2] ) this.store.dispatch( DimeMatrixActions.ONE.LOAD.INITIATEIFEMPTY.action( parseInt( segments[2], 10 ) ) );
							return new DoNothingAction();
						}
						case 'maps': {
							this.store.dispatch( DimeMapActions.ALL.LOAD.initiateifempty() );
							if ( segments[2] ) this.store.dispatch( DimeMapActions.ONE.LOAD.initiateifempty( parseInt( segments[2], 10 ) ) );
							return new DoNothingAction();
						}
						case 'streams': {
							this.store.dispatch( DimeStreamActions.ALL.LOAD.initiateifempty() );
							if ( segments[2] ) this.store.dispatch( DimeStreamActions.ONE.LOAD.initiateifempty( parseInt( segments[2], 10 ) ) );
							return new DoNothingAction();
						}
						case 'environments': {
							this.store.dispatch( DimeEnvironmentActions.ALL.LOAD.initiateifempty() );
							if ( segments[2] ) this.store.dispatch( DimeEnvironmentActions.ONE.LOAD.initiate( parseInt( segments[2], 10 ) ) );
							return new DoNothingAction();
						}
						// below are not new style
						case 'tags': {
							switch ( segments[2] ) {
								case 'tag-list': { return DimeTagGroupActions.ONE.selected( parseInt( segments[3], 10 ) ); }
								case 'tag-detail': { return DimeTagActions.ONE.LOAD.initiate( parseInt( segments[3], 10 ) ); }
								default: { console.log( 'We are at tags default' ); return new DoNothingAction(); }
							}
						}
						case 'secrets': {
							switch ( segments[2] ) {
								case 'secret-list': { return DimeSecretActions.ALL.LOAD.INITIATEIFEMPTY.action(); }
								case 'secret-detail': { return DimeSecretActions.ONE.LOAD.INITIATE.action( parseInt( segments[3], 10 ) ); }
								default: { console.log( 'We are at secrets default' ); return new DoNothingAction(); }
							}
						}
						case 'credentials': {
							switch ( segments[2] ) {
								case 'credential-list': { return DimeCredentialActions.ALL.LOAD.initiateifempty(); }
								case 'credential-detail': { return DimeCredentialActions.ONE.LOAD.initiate( parseInt( segments[3], 10 ) ); }
								default: { console.log( 'We are at credentials default' ); return new DoNothingAction(); }
							}
						}
						case 'asyncprocesses': {
							switch ( segments[2] ) {
								case 'asyncprocess-list': { return new DimeAsyncProcessAllLoadInitiateAction(); }
								default: { console.log( 'We are at async processes default' ); return new DoNothingAction(); }
							}
						}
						case 'settings': {
							return DimeSettingsActions.ALL.LOAD.INITIATEIFEMPTY.action();
						}
						default: {
							return new DoNothingAction();
						}
					}
				}
				default: {
					console.log( 'Falled back to default, WE SHOULD NEVER BE HERE' );
					return new DoNothingAction();
				}
			}
		} )
	);

	constructor(
		private actions$: Actions,
		private router: Router,
		private location: Location,
		private store: Store<AppState>
	) { }
}
