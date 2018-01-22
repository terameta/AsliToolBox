import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';

import { DimeMap } from '../../../../../shared/model/dime/map';

@Injectable()
export class DimeMapBackend {
	private baseUrl = '/api/dime/map';

	constructor( private http: HttpClient ) { }

	public allLoad = (): Observable<DimeMap[]> => this.http.get<DimeMap[]>( this.baseUrl );
	public oneLoad = ( id: number ): Observable<DimeMap> => this.http.get<DimeMap>( this.baseUrl + '/' + id );
	public oneCreate = ( refItem: DimeMap ): Observable<DimeMap> => this.http.post<DimeMap>( this.baseUrl, refItem );
	public oneUpdate = ( refItem: DimeMap ): Observable<DimeMap> => this.http.put<DimeMap>( this.baseUrl, refItem );
	public oneDelete = ( id: number ) => this.http.delete( this.baseUrl + '/' + id );
	public prepare = ( id: number ) => this.http.get( this.baseUrl + '/prepare/' + id );
	public isready = ( id: number ) => this.http.get( this.baseUrl + '/isready/' + id );
}
