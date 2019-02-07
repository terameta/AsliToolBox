import { DimeMatrix, DimeMatrixRefreshPayload } from '../../../../shared/model/dime/matrix';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IsReadyPayload } from '../../../../shared/enums/generic/readiness';

@Injectable()
export class DimeMatrixBackend {
	private baseUrl = '/api/dime/matrix';

	constructor( private http: HttpClient ) { }

	public allLoad = (): Observable<DimeMatrix[]> => this.http.get<DimeMatrix[]>( this.baseUrl );
	public oneCreate = ( refObj: DimeMatrix ): Observable<DimeMatrix> => this.http.post<DimeMatrix>( this.baseUrl, refObj );
	public oneLoad = ( id: number ): Observable<DimeMatrix> => this.http.get<DimeMatrix>( this.baseUrl + '/' + id );
	public oneDelete = ( id: number ) => this.http.delete( this.baseUrl + '/' + id );
	public oneUpdate = ( refObj: DimeMatrix ) => this.http.put( this.baseUrl, refObj );
	public prepareTables = ( id: number ) => this.http.get( this.baseUrl + '/prepareTables/' + id );
	public isready = ( id: number ) => this.http.get<IsReadyPayload>( this.baseUrl + '/isReady/' + id );
	public matrixRefresh = ( payload: DimeMatrixRefreshPayload ) => this.http.post( this.baseUrl + '/matrixRefresh', payload );
	public saveMatrixTuple = ( payload: { matrixid: number, tuple: any } ) => this.http.post( this.baseUrl + '/saveMatrixTuple', payload );
	public deleteMatrixTuple = ( payload: { matrixid: number, tupleid: number } ) => this.http.delete( this.baseUrl + '/deleteMatrixTuple/' + payload.matrixid + '/' + payload.tupleid );
	public matrixExport = ( id: number ) => this.http.get( this.baseUrl + /matrixExport/ + id, { responseType: 'blob' } );
	public matrixImport = ( formData: FormData ) => this.http.post( this.baseUrl + '/matrixImport', formData );
}
