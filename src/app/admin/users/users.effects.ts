import { HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Actions, Effect, ofType } from "@ngrx/effects";
import { of } from "rxjs";
import { catchError, filter, map, mergeMap, switchMap, tap } from "rxjs/operators";
import { RouterGo } from "../../router";
import { ActionTypes, Create, Delete, Load, Update } from "./users.actions";
import { BackEnd } from "./users.backend";

@Injectable()
export class Effects {
	@Effect() LOAD = this.actions$.pipe(
		ofType( ActionTypes.LOAD ),
		filter( ( a: Load ) => !a.payload ),
		switchMap( () => this.backend.load().pipe(
			map( resp => new Load( resp ) ),
			catchError( ( e: HttpErrorResponse ) => { console.log( e ); return of(); } )
		) )
	);

	@Effect() CREATE = this.actions$.pipe(
		ofType( ActionTypes.CREATE ),
		switchMap( ( a: Create ) => this.backend.create( a.payload ).pipe(
			tap( resp => console.log( resp ) ),
			mergeMap( resp => [
				new Load(),
				new RouterGo( { path: ['admin', 'users', resp.id] } )
			] ),
			catchError( ( e: HttpErrorResponse ) => { console.log( e ); return of(); } )
		) )
	);

	@Effect() UPDATE = this.actions$.pipe(
		ofType( ActionTypes.UPDATE )
		, switchMap( ( action: Update ) => this.backend.update( action.payload ).pipe(
			mergeMap( resp => [
				new Load()
			] ),
			catchError( ( e: HttpErrorResponse ) => { console.log( e ); return of(); } )
		) )
	);

	@Effect() DELETE = this.actions$.pipe(
		ofType( ActionTypes.DELETE )
		, switchMap( ( action: Delete ) => this.backend.delete( action.payload ).pipe(
			mergeMap( resp => [
				new Load(),
				new RouterGo( { path: ['admin', 'users'] } )
			] ),
			catchError( ( e: HttpErrorResponse ) => { console.log( e ); return of(); } )
		) )
	);

	constructor(
		private actions$: Actions,
		private backend: BackEnd,
		// private store: Store<AppState>
	) { }
}
