import { Component, OnInit } from '@angular/core';
import { AppState } from '../../../ngstore/models';
import { Store } from '@ngrx/store';
import { DimeSecretService } from '../dimesecret.service';
import { DimeSecretState } from '../dimesecret.state';

@Component( {
	selector: 'app-dimesecret-list',
	templateUrl: './dimesecret-list.component.html',
	styleUrls: ['./dimesecret-list.component.scss']
} )
export class DimeSecretListComponent implements OnInit {
	public state$: Store<DimeSecretState>;

	constructor(
		public store: Store<AppState>,
		public secretService: DimeSecretService
	) {
		this.state$ = store.select<DimeSecretState>( state => state.dimeSecret );
	}

	ngOnInit() {
	}

	public whiteListPresent = ( list: string[] ) => ( list ? list.map( i => i.trim() ).join( ', ' ) : '' );

}
