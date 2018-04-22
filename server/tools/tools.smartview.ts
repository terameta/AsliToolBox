import { Pool } from 'mysql';
import * as xml2js from 'xml2js';
import * as request from 'request';
import * as url from 'url';
import * as cheerio from 'cheerio';
import * as asynclib from 'async';
import { CheerioStatic } from 'cheerio';

import { MainTools } from './tools.main';
import { DimeEnvironmentSmartView } from '../../shared/model/dime/environmentSmartView';
import { DimeEnvironmentType } from '../../shared/enums/dime/environmenttypes';
import { DimeStreamFieldDetail } from '../../shared/model/dime/streamfield';
import { SmartViewRequestOptions } from '../../shared/model/dime/smartviewrequestoptions';
import { SortByName, encodeXML, SortByPosition, waiter, arrayCartesian } from '../../shared/utilities/utilityFunctions';
import * as _ from 'lodash';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as Promisers from '../../shared/utilities/promisers';
import { findMembers } from '../../shared/utilities/hpUtilities';

export class SmartViewTools {
	xmlBuilder: xml2js.Builder;
	xmlParser: xml2js.Parser;
	constructor( public db: Pool, public tools: MainTools ) {
		this.xmlBuilder = new xml2js.Builder();
		this.xmlParser = new xml2js.Parser();
	}
	public readData = ( payload ) => {
		return this.smartviewReadData( payload );
	}
	public smartviewReadData = async ( payload ) => {
		await this.smartviewReadDataPrepare( payload );
		return payload;
	}
	public smartviewReadDataPrepare = async ( payload ) => {
		await this.smartviewOpenCube( payload );

		payload.query.hierarchies = await this.smartviewGetAllDescriptionsWithHierarchy( payload, Object.values( payload.query.dimensions ).sort( SortByPosition ) );
		payload.query.povMembers = payload.query.povs.map( ( pov, pindex ) => findMembers( payload.query.hierarchies[payload.query.povDims[pindex]], pov.selectionType, pov.selectedMember ) );

		const colCartesian = payload.query.cols.map( col => {
			return arrayCartesian( col.map( ( selection, sindex ) => {
				return findMembers( payload.query.hierarchies[payload.query.colDims[sindex]], selection.selectionType, selection.selectedMember );
			} ) );
		} );
		payload.query.colMembers = [];
		colCartesian.forEach( cm => {
			payload.query.colMembers = payload.query.colMembers.concat( cm );
		} );

		payload.query.memberCounts = <any>{};
		payload.query.memberCounts.povs = 1;
		payload.query.memberCounts.rows = [];
		payload.query.memberCounts.cols = [];
		payload.query.povs.forEach( ( pov, index ) => {
			pov.memberList = findMembers( payload.query.hierarchies[payload.query.povDims[index]], pov.selectionType, pov.selectedMember );
			pov.memberCount = pov.memberList.length;
			payload.query.memberCounts.povs *= pov.memberCount;
		} );
		payload.query.rows.forEach( ( row, index ) => {
			let rowCount = 1;
			row.forEach( ( selection, dimindex ) => {
				selection.memberList = findMembers( payload.query.hierarchies[payload.query.rowDims[dimindex]], selection.selectionType, selection.selectedMember );
				selection.memberCount = selection.memberList.length;
				rowCount *= selection.memberCount;
			} );
			payload.query.memberCounts.rows.push( rowCount );
		} );
		payload.query.cols.forEach( ( col, index ) => {
			let colCount = 1;
			col.forEach( ( selection, dimindex ) => {
				selection.memberList = findMembers( payload.query.hierarchies[payload.query.colDims[dimindex]], selection.selectionType, selection.selectedMember );
				selection.memberCount = selection.memberList.length;
				colCount *= selection.memberCount;
			} );
			payload.query.memberCounts.cols.push( colCount );
		} );

		payload.query.memberCounts.totalRowIntersections = payload.query.memberCounts.rows.reduce( ( accumulator, currentValue ) => accumulator + currentValue );
		payload.query.memberCounts.totalColIntersections = payload.query.memberCounts.cols.reduce( ( accumulator, currentValue ) => accumulator + currentValue );

		payload.pullLimit = 3000000;
		payload.pullThreadNumber = 12;
		payload.pullThreadPool = []; for ( let x = 0; x < payload.pullThreadNumber; x++ ) payload.pullThreadPool[x] = 0;

		if ( payload.query.memberCounts.totalColIntersections > payload.pullLimit ) {
			return Promise.reject( new Error( 'Too many intersections on the column (' + payload.query.memberCounts.totalColIntersections + '). Limit is ' + payload.pullLimit ) );
		}
		payload.rowsPerChunck = Math.floor( payload.pullLimit / payload.query.memberCounts.totalColIntersections );

		payload.data = [];

		payload.numberOfChuncks = Math.ceil( payload.query.memberCounts.totalRowIntersections / payload.rowsPerChunck );

		const numberOfRowDimensions = payload.query.rowDims.length;
		const chunck: string[][] = [];

		let whichChunck = 0;
		// let whichRow = 0;

		for ( const row of payload.query.rows ) {
			payload.currentRowIntersection = payload.query.rowDims.map( r => 0 );
			payload.currentRowIntersectionLimits = row.map( r => r.memberCount );
			let keepWorking = true;

			while ( keepWorking ) {
				// console.log( 'Working on', ( ++whichRow ).toString().padStart( 7, '0' ), payload.currentRowIntersection, payload.currentRowIntersectionLimits );
				chunck.push( payload.currentRowIntersection.map( ( index, dimindex ) => row[dimindex].memberList[index].RefField ) );
				if ( chunck.length === payload.rowsPerChunck ) {
					const threadToAssign = await this.waitForEmptyThread( payload.pullThreadPool );
					payload.pullThreadPool[threadToAssign] = 1;
					this.smartviewReadDataPullChunck( threadToAssign, payload, chunck.splice( 0 ), 0, ++whichChunck )
						.then( threadToRelease => payload.pullThreadPool[threadToRelease] = 0 )
						.catch( issue => payload.pullThreadPool[threadToAssign] = 0 );
				}

				let currentIndex = numberOfRowDimensions - 1;
				while ( currentIndex >= 0 ) {
					payload.currentRowIntersection[currentIndex] = ( payload.currentRowIntersection[currentIndex] + 1 ) % payload.currentRowIntersectionLimits[currentIndex];
					if ( payload.currentRowIntersection[currentIndex] === 0 ) {
						currentIndex--;
					} else {
						currentIndex = -1;
					}
				}
				if ( payload.currentRowIntersection.reduce( ( accumulator, currentValue ) => accumulator + currentValue ) === 0 ) keepWorking = false;

				// await waiter( 5000 );
				// if ( whichChunck > 100 ) keepWorking = false;
			}
		}

		if ( chunck.length > 0 ) {
			const threadFinal = await this.waitForEmptyThread( payload.pullThreadPool );
			payload.pullThreadPool[threadFinal] = 1;
			this.smartviewReadDataPullChunck( threadFinal, payload, chunck.splice( 0 ), 0, ++whichChunck )
				.then( threadToRelease => payload.pullThreadPool[threadToRelease] = 0 )
				.catch( issue => payload.pullThreadPool[threadFinal] = 0 );
		}

		await this.waitForAllThreadsCompletion( payload.pullThreadPool );

		// return Promise.reject( new Error( 'Not yet' ) );
		// return payload;
	}
	private smartviewReadDataPullChunck = ( thread: number, payload, chunck, retrycount = 0, whichChunck: number ): Promise<number> => {
		const maxRetry = 10;
		return new Promise( ( resolve, reject ) => {
			this.smartviewReadDataPullChunckAction( payload, chunck, whichChunck ).then( () => resolve( thread ) ).catch( issue => {
				if ( retrycount < maxRetry ) {
					retrycount++;
					console.log( '?????', payload.pullThreadPool.join( '' ), thread, retrycount, maxRetry, 'Chunck Length:', chunck.length, issue );
					// payload.pullThreadPool[thread]++;
					resolve( this.smartviewReadDataPullChunck( thread, payload, chunck, retrycount, whichChunck ) );
				} else {
					reject( issue );
				}
			} );
		} );
	}
	private smartviewReadDataPullChunckAction = async ( payload, chunck: any[], whichChunck: number ) => {
		const startTime = new Date();

		const valueArray = [];
		const typeArray = [];

		payload.query.colDims.forEach( ( colDim, colDimIndex ) => {
			payload.query.rowDims.forEach( ( rowDim, rowDimIndex ) => {
				valueArray.push( '' );
				typeArray.push( '7' );
			} );
			payload.query.colMembers.forEach( colMember => {
				valueArray.push( colMember[colDimIndex].RefField );
				typeArray.push( '0' );
			} );
		} );
		chunck.forEach( ( rowMemberList, rowMemberIndex ) => {
			rowMemberList.forEach( rowMember => {
				valueArray.push( rowMember );
				typeArray.push( 0 );
			} );
			payload.query.colMembers.forEach( colMember => {
				valueArray.push( '' );
				typeArray.push( '2' );
			} );
		} );

		const params: any = {};
		params.SID = payload.SID;
		params.cube = payload.table;
		params.rows = payload.query.colDims.length + chunck.length;
		params.cols = payload.query.rowDims.length + payload.query.colMembers.length;
		params.range = { start: 0, end: ( ( payload.query.colDims.length + chunck.length ) * ( payload.query.rowDims.length + payload.query.colMembers.length ) - 1 ) };
		params.povDims = payload.query.povDims.map( ( cd, index ) => ( { refreshid: index, name: payload.query.dimensions[cd].name, memberName: payload.query.povs[index].memberList[0].RefField } ) );
		params.rowDims = payload.query.rowDims.map( ( cd, index ) => ( { refreshid: index + payload.query.povDims.length, name: payload.query.dimensions[cd].name, roworder: index } ) );
		params.colDims = payload.query.colDims.map( ( cd, index ) => ( { refreshid: index + payload.query.povDims.length + payload.query.rowDims.length, name: payload.query.dimensions[cd].name, colorder: index } ) );
		params.vals = valueArray.join( '|' );
		params.types = typeArray.join( '|' );

		const bodyXML = await Promisers.readFile( path.join( __dirname, './tools.smartview.assets/req_Refresh.xml' ) );
		const bodyTemplate = Handlebars.compile( bodyXML );
		const body = bodyTemplate( params );

		console.log( '>>>', payload.pullThreadPool.join( '' ), 'Pulling chunck', whichChunck, '/', payload.numberOfChuncks, 'posted.' );
		const response = await this.smartviewPoster( { url: payload.planningurl, body, cookie: payload.cookies, timeout: 120000000 } );

		const doWeHaveData = response.$( 'body' ).children().toArray().filter( elem => ( elem.name === 'res_refresh' ) ).length > 0;
		const totalTime = ( ( new Date() ).getTime() - startTime.getTime() ) / 1000;
		console.log( '>>>', payload.pullThreadPool.join( '' ), 'Pulling chunck', whichChunck, '/', payload.numberOfChuncks, 'received. WithData:', doWeHaveData, '-', totalTime, 'secs' );
		if ( doWeHaveData ) {
			const rangeStart = parseInt( response.$( 'range' ).attr( 'start' ), 10 );
			const rangeEnd = parseInt( response.$( 'range' ).attr( 'end' ), 10 );
			const cellsToSkip = payload.query.colDims.length * ( payload.query.rowDims.length + payload.query.colMembers.length ) - rangeStart;
			const vals: string[] = response.$( 'vals' ).text().split( '|' ).splice( cellsToSkip );
			const stts: string[] = response.$( 'status' ).text().split( '|' ).splice( cellsToSkip );
			const typs: string[] = response.$( 'types' ).text().split( '|' ).splice( cellsToSkip );
			while ( vals.length > 0 ) {
				payload.data.push( vals.splice( 0, payload.query.rowDims.length + payload.query.colMembers.length ) );
			}
			return Promise.resolve( payload );
		} else {
			if ( response.body.indexOf( 'there are no valid rows of data' ) >= 0 ) {
				return Promise.resolve( payload );
			} else {
				console.log( response.body );
				return Promise.reject( new Error( response.$( 'desc' ).text() ) );
			}
		}
	}
	private waitForAllThreadsCompletion = ( list: number[] ): Promise<boolean> => {
		return new Promise( ( resolve, reject ) => {
			const toClear = setInterval( () => {
				console.log( 'Waiting for All threads completion:', list.join( '' ) );
				if ( list.filter( i => i > 0 ).length === 0 ) {
					resolve();
					clearInterval( toClear );
				}
			}, 1000 );
		} );
	}
	private waitForEmptyThread = ( list: number[] ): Promise<number> => {
		return new Promise( ( resolve, reject ) => {
			let foundIndex = list.findIndex( i => i === 0 );
			if ( foundIndex >= 0 ) {
				resolve( foundIndex );
			} else {
				const toClear = setInterval( () => {
					foundIndex = list.findIndex( i => i === 0 );
					if ( foundIndex >= 0 ) {
						resolve( foundIndex );
						clearInterval( toClear );
					}
				}, 2000 );
			}
		} );
	}
	private smartviewReadDataOLD = ( payload ) => {
		return new Promise( ( resolve, reject ) => {
			payload.dims = _.keyBy( payload.query.dims, 'id' );
			payload.pullLimit = 10000000;
			payload.data = [];
			payload.startTime = new Date();
			payload.numberofRowsPerChunck = Math.floor( payload.pullLimit / payload.query.colMembers.length );
			if ( payload.numberofRowsPerChunck < 1 ) {
				payload.numberofRowsPerChunck = 1;
			}
			payload.numberOfChuncks = Math.ceil( payload.query.rowMembers.length / payload.numberofRowsPerChunck );
			this.smartviewReadDataPullChuncks( payload ).then( resolve ).catch( reject );
		} );
	}
	private smartviewReadDataPullChuncks = ( payload ) => {
		console.log( '>>> Pulling chunck', ( payload.consumedChuncks + 1 ), '/', payload.numberOfChuncks );
		const startTime = new Date();
		return new Promise( ( resolve, reject ) => {
			if ( payload.query.rowMembers.length < 1 ) {
				resolve( payload );
			} else {
				const chunck = payload.query.rowMembers.splice( 0, payload.numberofRowsPerChunck );
				this.smartviewReadDataPullChuncksTry( payload, chunck ).then( result => {
					payload.consumedChuncks++;
					const finishTime = new Date();
					console.log( '>>> Pulling chunck', payload.consumedChuncks, '/', payload.numberOfChuncks, 'finished. Duration:', ( finishTime.getTime() - startTime.getTime() ) / 1000 );
					resolve( this.smartviewReadDataPullChuncks( payload ) );
				} ).catch( reject );
			}
		} );
	}
	private smartviewReadDataPullChuncksTry = ( payload, chunck: any[], retrycount = 0 ) => {
		const maxRetry = 10;
		return new Promise( ( resolve, reject ) => {
			this.smartviewReadDataPullChuncksAction( payload, chunck ).then( resolve ).catch( issue => {
				if ( retrycount < maxRetry ) {
					resolve( this.smartviewReadDataPullChuncksTry( payload, chunck, ++retrycount ) );
				} else {
					reject( issue );
				}
			} );
		} );
	}
	private smartviewReadDataPullChuncksAction = ( payload, chunck: any[] ) => {
		let body = '';
		const startTime = new Date();
		return this.smartviewOpenCube( payload )
			.then( resEnv => {
				body += '<req_Refresh>';
				body += '<sID>' + resEnv.SID + '</sID>';
				body += '<preferences>';
				body += '<row_suppression zero="1" invalid="0" missing="1" underscore="0" noaccess="0"/>';
				body += '<celltext val="1"/>';
				body += '<zoomin ancestor="bottom" mode="children"/>';
				body += '<navigate withData="1"/>';
				body += '<includeSelection val="1"/>';
				body += '<repeatMemberLabels val="1"/>';
				body += '<withinSelectedGroup val="0"/>';
				body += '<removeUnSelectedGroup val="0"/>';
				body += '<col_suppression zero="0" invalid="0" missing="0" underscore="0" noaccess="0"/>';
				body += '<block_suppression missing="1"/>';
				body += '<includeDescriptionInLabel val="2"/>';
				body += '<missingLabelText val=""/>';
				body += '<noAccessText val="#No Access"/>';
				body += '<aliasTableName val="none"/>';
				body += '<essIndent val="2"/>';
				body += '<FormatSetting val="2"/>';
				body += '<sliceLimitation rows="1048576" cols="16384"/>';
				body += '</preferences>';
				body += '<grid>';
				body += '<cube>' + resEnv.table + '</cube>';
				body += '<dims>';
				let currentID = 0;
				payload.query.povDims.forEach( ( dim, dimindex ) => {
					const memberName = payload.query.povMembers[dimindex][0].RefField;
					body += '<dim id="' + currentID + '" name="' + payload.dims[dim].name + '" pov="' + memberName + '" display="' + memberName + '" hidden="0" expand="0"/>';
					currentID++;
				} );
				payload.query.rowDims.forEach( ( dim, dimindex ) => {
					body += '<dim id="' + currentID + '" name="' + payload.dims[dim].name + '" row="' + dimindex + '" hidden="0" expand="0"/>';
					currentID++;
				} );
				payload.query.colDims.forEach( ( dim, dimindex ) => {
					body += '<dim id="' + currentID + '" name="' + payload.dims[dim].name + '" col="' + dimindex + '" hidden="0" expand="0"/>';
					currentID++;
				} );
				body += '</dims>';
				body += '<perspective type="Reality"/>';
				body += '<slices>';
				body += '<slice rows="' + ( payload.query.colDims.length + chunck.length ) + '" cols="' + ( payload.query.rowDims.length + payload.query.colMembers.length ) + '">';
				body += '<data>';
				body += '<range start="0" end="' + ( ( payload.query.colDims.length + chunck.length ) * ( payload.query.rowDims.length + payload.query.colMembers.length ) - 1 ) + '">';
				const valueArray = [];
				const typeArray = [];
				payload.query.colDims.forEach( ( colDim, colDimIndex ) => {
					payload.query.rowDims.forEach( ( rowDim, rowDimIndex ) => {
						valueArray.push( '' );
						typeArray.push( '7' );
					} );
					payload.query.colMembers.forEach( colMember => {
						// console.log( '***', colMember );
						valueArray.push( colMember[colDimIndex].RefField );
						typeArray.push( '0' );
					} );
				} );
				chunck.forEach( ( rowMemberList, rowMemberIndex ) => {
					rowMemberList.forEach( rowMember => {
						valueArray.push( rowMember.RefField );
						typeArray.push( 0 );
					} );
					payload.query.colMembers.forEach( colMember => {
						valueArray.push( '' );
						typeArray.push( '2' );
					} );
					// console.log( rowMemberIndex, rowMemberList );
				} );
				// console.log( valueArray.join( '|' ) );
				// console.log( typeArray.join( '|' ) );
				body += '<vals>' + valueArray.join( '|' ) + '</vals>';
				body += '<types>' + typeArray.join( '|' ) + '</types>';
				body += '</range>';
				body += '</data>';
				body += '<metadata/>';
				body += '<conditionalFormats/>';
				body += '</slice>';
				body += '</slices>';
				body += '</grid>';
				body += '</req_Refresh>';
				console.log( '>>> Pulling chunck', ( payload.consumedChuncks + 1 ), '/', payload.numberOfChuncks, 'posted.' );
				return this.smartviewPoster( { url: resEnv.planningurl, body, cookie: resEnv.cookies, timeout: 120000000 } );
				// return Promise.reject( 'Trying something' );
			} )
			.then( response => {
				console.log( '>>> Pulling chunck', ( payload.consumedChuncks + 1 ), '/', payload.numberOfChuncks, 'received.' );
				const doWeHaveData = response.$( 'body' ).children().toArray().filter( elem => ( elem.name === 'res_refresh' ) ).length > 0;
				console.log( '>>>>>>>>>>>Do We Have Data:', doWeHaveData, '>>>>>>>>>>>Duration Passed:', ( ( new Date() ).getTime() - startTime.getTime() ) / 1000, 'seconds' );
				if ( doWeHaveData ) {
					const rangeStart = parseInt( response.$( 'range' ).attr( 'start' ), 10 );
					const rangeEnd = parseInt( response.$( 'range' ).attr( 'end' ), 10 );
					const cellsToSkip = payload.query.colDims.length * ( payload.query.rowDims.length + payload.query.colMembers.length ) - rangeStart;
					const vals: string[] = response.$( 'vals' ).text().split( '|' ).splice( cellsToSkip );
					const stts: string[] = response.$( 'status' ).text().split( '|' ).splice( cellsToSkip );
					const typs: string[] = response.$( 'types' ).text().split( '|' ).splice( cellsToSkip );
					while ( vals.length > 0 ) {
						payload.data.push( vals.splice( 0, payload.query.rowDims.length + payload.query.colMembers.length ) );
					}
					return Promise.resolve( payload );
				} else {
					const errcode = response.$( 'exception' ).attr( 'errcode' );
					if ( errcode === '1000' ) {
						return Promise.resolve( payload );
					} else {
						console.log( response.body );
						return Promise.reject( new Error( response.$( 'desc' ).text() ) );
					}
				}
			} ).catch( issue => {
				console.log( issue );
				console.log( 'Time to failure:', ( ( new Date() ).getTime() - startTime.getTime() ) / 1000, 'seconds' );
				return Promise.reject( issue );
			} );
	}
	public runBusinessRule = ( payload ) => {
		return this.smartviewRunBusinessRule( payload );
	}
	private smartviewRunBusinessRule = ( payload, retrycount = 0 ) => {
		const maxRetry = 10;
		return new Promise( ( resolve, reject ) => {
			this.smartviewRunBusinessRuleAction( payload ).then( resolve ).catch( issue => {
				if ( retrycount < maxRetry ) {
					resolve( this.smartviewRunBusinessRule( payload, ++retrycount ) );
				} else {
					reject( issue );
				}
			} );
		} );
	}
	private smartviewRunBusinessRuleAction = ( payload ): Promise<any> => {
		let body = '';
		return this.smartviewOpenCube( payload ).then( resEnv => {
			body += '<req_LaunchBusinessRule>';
			body += '<sID>' + resEnv.SID + '</sID>';
			body += '<cube>' + resEnv.table + '</cube>';
			body += '<rule type="' + resEnv.procedure.type + '">' + resEnv.procedure.name + '</rule>';
			body += '<prompts>';
			resEnv.procedure.variables.forEach( ( curRTP: any ) => {
				body += '<rtp>';
				body += '<name>' + curRTP.name + '</name>';
				body += '<val>' + curRTP.value + '</val>';
				body += '</rtp>';
			} );
			body += '</prompts>';
			body += '<ODL_ECID>0000</ODL_ECID>';
			body += '</req_LaunchBusinessRule>';
			return this.smartviewPoster( { url: resEnv.planningurl, body, cookie: resEnv.cookies } );
		} ).then( response => {
			const isSuccessful = response.$( 'body' ).children().toArray().filter( elem => ( elem.name === 'res_launchbusinessrule' ) ).length > 0;
			if ( isSuccessful ) {
				return Promise.resolve();
			} else {
				return Promise.reject( new Error( 'There is an issue with running business rule ' + response.body ) );
			}
		} );
	}
	public writeData = ( payload ) => {
		return this.smartviewWriteData( payload );
	}
	private smartviewWriteData = ( payload ) => {
		return new Promise( ( resolve, reject ) => {
			payload.issueList = [];
			payload.cellsTotalCount = 0;
			payload.cellsValidCount = 0;
			payload.cellsInvalidCount = 0;
			const pushLimit = 5000;
			const wholeData = payload.data;
			let numberofRowsPerChunck = Math.floor( pushLimit / ( Object.keys( wholeData[0] ).length - payload.sparseDims.length ) );
			if ( numberofRowsPerChunck < 1 ) {
				numberofRowsPerChunck = 1;
			}
			const chunkedData: any[] = [];
			while ( wholeData.length > 0 ) {
				chunkedData.push( wholeData.splice( 0, numberofRowsPerChunck ) );
			}
			this.smartviewWriteDataSendChuncks( payload, chunkedData ).then( () => { resolve( payload ); } ).catch( reject );
		} );
	}
	private smartviewWriteDataSendChuncks = ( payload, chunks: any[] ) => {
		return new Promise( ( resolve, reject ) => {
			asynclib.eachOfSeries( chunks, ( chunk, key, callback ) => {
				payload.data = chunk;
				this.smartviewWriteDataTry( payload, 0 ).then( result => { callback(); } ).catch( callback );
			}, ( err ) => {
				if ( err ) {
					reject( err );
				} else {
					resolve();
				}
			} );
		} );
	}
	private smartviewWriteDataTry = ( payload, retrycount = 0 ) => {
		const maxRetry = 10;
		return new Promise( ( resolve, reject ) => {
			this.smartviewWriteDataAction( payload ).then( resolve ).catch( issue => {
				if ( retrycount < maxRetry ) {
					resolve( this.smartviewWriteDataTry( payload, ++retrycount ) );
				} else {
					reject( issue );
				}
			} );
		} );
	}
	private smartviewWriteDataAction = ( payload ) => {
		let body = '';
		return this.smartviewOpenCube( payload ).then( resEnv => {
			body += '<req_WriteBack>';
			body += '<sID>' + resEnv.SID + '</sID>';
			body += '<preferences />';
			body += '<grid>';
			body += '<cube>' + resEnv.table + '</cube>';
			body += '<dims>';
			payload.sparseDims.forEach( function ( curDim: string, curKey: number ) {
				body += '<dim id="' + curKey + '" name="' + curDim + '" row="' + curKey + '" hidden="0" />';
			} );
			body += '<dim id="' + payload.sparseDims.length + '" name="' + payload.denseDim + '" col="0" hidden="0" />';
			body += '</dims>';
			body += '<slices>';
			body += '<slice rows="' + ( payload.data.length + 1 ) + '" cols="' + Object.keys( payload.data[0] ).length + '">';
			body += '<data>';
			const dirtyCells: any[] = [];
			const vals: any[] = [];
			const typs: any[] = [];
			const stts: any[] = [];
			const rowHeaders: { type: string, name: string }[] = [];
			const colHeaders: { type: string, name: string }[] = [];
			const headerTuple = JSON.parse( JSON.stringify( payload.data[0] ) );
			payload.sparseDims.forEach( dimensionName => {
				rowHeaders.push( { type: 'sparse', name: dimensionName } );
				delete headerTuple[dimensionName];
			} );
			Object.keys( headerTuple ).forEach( denseMemberName => {
				colHeaders.push( { type: 'dense', name: denseMemberName } );
			} );

			let i = 0;

			colHeaders.sort( SortByName );
			rowHeaders.forEach( rowHeader => {
				vals.push( '' );
				typs.push( '7' );
				stts.push( '' );
				dirtyCells.push( '' );
				i++;
			} );
			colHeaders.forEach( colHeader => {
				vals.push( colHeader.name );
				typs.push( '0' );
				stts.push( '0' );
				dirtyCells.push( '' );
				i++;
			} );
			payload.data.forEach( ( curTuple: any ) => {
				rowHeaders.forEach( rowHeader => {
					vals.push( curTuple[rowHeader.name].toString() );
					typs.push( '0' );
					stts.push( '0' );
					dirtyCells.push( '' );
					i++;
				} );
				colHeaders.forEach( colHeader => {
					typs.push( '2' );
					if ( curTuple[colHeader.name] ) {
						stts.push( '258' );
						vals.push( parseFloat( curTuple[colHeader.name] ).toString() );
						dirtyCells.push( i.toString( 10 ) );
					} else {
						stts.push( '8193' );
						vals.push( '' );
						dirtyCells.push( '' );
					}
					i++;
				} );
			} );
			const rangeEnd = ( payload.data.length + 1 ) * Object.keys( payload.data[0] ).length;
			body += '<dirtyCells>' + encodeXML( dirtyCells.join( '|' ) ) + '</dirtyCells>';
			body += '<range start="0" end="' + ( rangeEnd - 1 ) + '">';
			body += '<vals>' + encodeXML( vals.join( '|' ) ) + '</vals>';
			body += '<types>' + encodeXML( typs.join( '|' ) ) + '</types>';
			body += '<status enc="0">' + stts.join( '|' ) + '</status>';
			body += '</range>';
			body += '</data>';
			body += '</slice>';
			body += '</slices>';
			body += '</grid>';
			body += '</req_WriteBack>';
			return this.smartviewPoster( { url: resEnv.planningurl, body, cookie: resEnv.cookies } );
		} ).then( response => {
			const rangeStart = parseInt( response.$( 'range' ).attr( 'start' ), 10 );
			const rangeEnd = parseInt( response.$( 'range' ).attr( 'end' ), 10 );
			const vals = response.$( 'vals' ).text().split( '|' );
			const stts = response.$( 'status' ).text().split( '|' );
			const headers = Object.keys( payload.data[0] );
			const cellsToSkip = headers.length - rangeStart;
			vals.splice( 0, cellsToSkip );
			stts.splice( 0, cellsToSkip );
			const results: any[] = [];
			while ( vals.length > 0 ) {
				const sparsePart: any = {};
				// Prepare the sparse part
				headers.forEach( ( header, index ) => {
					if ( index < payload.sparseDims.length ) {
						sparsePart[vals.splice( 0, 1 )[0]] = stts.splice( 0, 1 )[0];
					}
				} );

				headers.forEach( ( header, index ) => {
					if ( index >= payload.sparseDims.length ) {
						const result = JSON.parse( JSON.stringify( sparsePart ) );
						result[header] = vals.splice( 0, 1 )[0];
						result.writestatus = stts.splice( 0, 1 )[0];
						results.push( result );
					}
				} );

			}
			results.forEach( result => {
				result.finalStatus = '';
				if ( result.writestatus !== '8194' && result.writestatus !== '2' ) {
					result.finalStatus = 'Target is not valid: ' + result.writestatus;
				}
				payload.cellsTotalCount++;
				if ( result.finalStatus !== '' ) {
					payload.cellsInvalidCount++;
					payload.issueList.push( Object.keys( result ).filter( ( element, index ) => index <= payload.sparseDims.length ).join( '|' ) + ' => ' + result.finalStatus );
				} else {
					payload.cellsValidCount++;
				}
			} );
			const isSuccessful = response.$( 'body' ).children().toArray().filter( elem => ( elem.name === 'res_writeback' ) ).length > 0;
			if ( isSuccessful ) {
				return Promise.resolve( 'Data is pushed to Hyperion Planning' );
			} else {
				return Promise.reject( new Error( 'Failed to write data:' + response.body ) );
			}
		} );
	}
	public listBusinessRuleDetails = ( environment: DimeEnvironmentSmartView ) => {
		return this.smartviewListBusinessRuleDetails( environment );
	}
	private smartviewListBusinessRuleDetails = ( environment: DimeEnvironmentSmartView ) => {
		return this.smartviewOpenCube( environment )
			.then( resEnv => {
				// tslint:disable-next-line:max-line-length
				const body = '<req_EnumRunTimePrompts><sID>' + resEnv.SID + '</sID><cube>' + resEnv.table + '</cube ><rule type="' + resEnv.procedure.type + '">' + resEnv.procedure.name + '</rule><ODL_ECID>0000</ODL_ECID></req_EnumRunTimePrompts>';
				return this.smartviewPoster( { url: resEnv.planningurl, body, cookie: resEnv.cookies } );
			} )
			.then( response => {
				const rtps: any[] = [];
				response.$( 'rtp' ).toArray().forEach( rtp => {
					const toPush: any = {};
					toPush.name = response.$( rtp ).find( 'name' ).text();
					toPush.description = response.$( rtp ).find( 'description' ).text();
					toPush.dimension = response.$( rtp ).find( 'member' ).toArray()[0].attribs.dim;
					toPush.memberselect = response.$( rtp ).find( 'member' ).toArray()[0].attribs.mbrselect;
					if ( toPush.memberselect === '0' ) {
						toPush.memberselect = false;
					} else {
						toPush.memberselect = true;
					}
					toPush.choice = response.$( rtp ).find( 'member' ).toArray()[0].attribs.choice;
					toPush.defaultmember = response.$( rtp ).find( 'member' ).find( 'default' ).text();
					toPush.allowmissing = response.$( rtp ).find( 'allowMissing' ).text();
					rtps.push( toPush );
				} );
				return Promise.resolve( rtps );
			} );
	}
	public listBusinessRules = ( environment: DimeEnvironmentSmartView ) => {
		return this.smartviewListBusinessRules( environment );
	}
	private smartviewListBusinessRules = ( environment: DimeEnvironmentSmartView ) => {
		return this.smartviewOpenCube( environment )
			.then( resEnv => {
				const body = '<req_EnumBusinessRules><sID>' + resEnv.SID + '</sID><cube>' + resEnv.table + '</cube><runOnSave>0</runOnSave><ODL_ECID>0000</ODL_ECID></req_EnumBusinessRules>';
				return this.smartviewPoster( { url: resEnv.planningurl, body, cookie: resEnv.cookies } );
			} )
			.then( response => {
				const isSuccessful = response.$( 'body' ).children().toArray().filter( elem => ( elem.name === 'res_enumbusinessrules' ) ).length > 0;
				if ( isSuccessful ) {
					const ruleList: any[] = response.$( 'rule' ).toArray().map( rule => ( { name: response.$( rule ).text(), hasRTP: rule.attribs.rtp, type: rule.attribs.type } ) );
					return Promise.resolve( ruleList );
				} else {
					return Promise.reject( new Error( 'Failure to list business rules ' + environment.name + '@smartviewListBusinessRules' ) );
				}
			} );
	}
	public getDescriptionsWithHierarchy = ( refObj: DimeEnvironmentSmartView, refField: DimeStreamFieldDetail ) => {
		return this.smartviewGetDescriptionsWithHierarchy( refObj, refField ).then( result => result.memberList );
	}
	private smartviewGetDescriptionsWithHierarchy = ( refObj: DimeEnvironmentSmartView, refField: DimeStreamFieldDetail ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewListAliasTables( refObj )
			.then( resEnv => { refObj = resEnv; return this.smartviewOpenDimension( refObj, refField ); } )
			.then( resEnv => { refObj = resEnv; return this.smartviewGetDescriptionsWithHierarchyAction( refObj, refField ); } );
	}
	private smartviewGetAllDescriptionsWithHierarchy = async ( refObj: DimeEnvironmentSmartView, refFields: DimeStreamFieldDetail[] ) => {
		const toReturn: any = {};
		await Promise.all( refFields.map( async ( field ) => this.smartviewGetAllDescriptionsWithHierarchyAction( refObj, field, toReturn ) ) );
		return toReturn;
	}
	private smartviewGetAllDescriptionsWithHierarchyAction = ( refObj, field, toReturn ) => {
		const sourceEnvironment = JSON.parse( JSON.stringify( refObj ) );
		return new Promise( ( resolve, reject ) => {
			this.smartviewGetDescriptionsWithHierarchy( sourceEnvironment, field ).then( result => {
				toReturn[field.id] = result.memberList;
				resolve();
			} );
		} );
	}
	private smartviewGetDescriptionsWithHierarchyAction = ( refObj: DimeEnvironmentSmartView, refField: DimeStreamFieldDetail ): Promise<DimeEnvironmentSmartView> => {
		const numberofColumns = 4; // Because columns are membername, description, desired aliastable name and parent
		let body = '';
		body += '<req_ExecuteGrid>';
		body += '<sID>' + refObj.SID + '</sID>';
		body += '<action>zoomin</action>';
		body += '<ords>' + numberofColumns + '</ords>';
		body += '<preferences>';
		body += '<row_suppression zero="0" invalid="0" missing="0" underscore="0" noaccess="0"/>';
		body += '<celltext val="1"/>';
		body += '<zoomin ancestor="top" mode="descendents"/>';
		body += '<navigate withData="1"/>';
		body += '<includeSelection val="1"/>';
		body += '<repeatMemberLabels val="1"/>';
		body += '<withinSelectedGroup val="0"/>';
		body += '<removeUnSelectedGroup val="0"/>';
		body += '<col_suppression zero="0" invalid="0" missing="0" underscore="0" noaccess="0"/>';
		body += '<block_suppression missing="0"/>';
		body += '<includeDescriptionInLabel val="0"/>';
		body += '<missingLabelText val=""/>';
		body += '<noAccessText val="#No Access"/>';
		body += '<essIndent val="2"/>';
		body += '<sliceLimitation rows="1048576" cols="16384"/>';
		body += '</preferences>';
		body += '<grid>';
		body += '<cube>' + refObj.table + '</cube>';
		body += '<dims>';
		body += '<dim id="0" name="' + refField.name + '" row="0" hidden="0" expand="0"/>';
		body += '<dim id="1" name="Member Properties" col="0" hidden="0" expand="0"/>';
		body += '</dims>';
		body += '<perspective type="Reality"/>';
		body += '<slices>';
		body += '<slice rows="2" cols="' + numberofColumns + '">';
		body += '<data>';
		body += '<range start="0" end="' + ( numberofColumns * 2 - 1 ) + '">';
		body += '<vals>|Description|Parent Member|' + refField.descriptiveTable + ' Alias Table' + '|' + refField.name + '|||</vals>';
		body += '<types>7|0|0|0|0|13|13|13</types>';
		body += '</range>';
		body += '</data>';
		body += '<metadata/>';
		body += '<conditionalFormats/>';
		body += '</slice>';
		body += '</slices>';
		body += '</grid>';
		body += '</req_ExecuteGrid>';
		return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_executegrid' ) { isSuccessful = true; }
				} );

				const rangeStart = parseInt( response.$( 'range' ).attr( 'start' ), 10 );

				if ( !isSuccessful ) {
					return Promise.reject( new Error( 'Failure to get descriptions ' + refObj.name + '@smartviewGetDescriptionsAction' ) );
				} else if ( rangeStart > 1 ) {
					return Promise.reject( new Error( 'Failure to get descriptions, wrong number returned for rangeStart ' + refObj.name + '@smartviewGetDescriptionsAction' ) );
				} else {
					const vals = response.$( 'vals' ).text().split( '|' );
					vals.splice( 0, ( numberofColumns - rangeStart ) );
					refObj.memberList = [];
					while ( vals.length ) {
						const curMemberArray = vals.splice( 0, numberofColumns );
						const curMember: { RefField: string, Description: string, Parent: string } = { RefField: curMemberArray[0], Description: curMemberArray[numberofColumns - 1], Parent: curMemberArray[2] };
						if ( !curMember.Description ) { curMember.Description = curMemberArray[1]; }
						if ( !curMember.Description ) { curMember.Description = curMemberArray[0]; }
						refObj.memberList.push( curMember );
					}
					return Promise.resolve( refObj );
				}
			} );
	}
	public getDescriptions = ( refObj: DimeEnvironmentSmartView, refField: DimeStreamFieldDetail ) => {
		return this.smartviewGetDescriptions( refObj, refField ).then( result => result.memberList );
	}
	private smartviewGetDescriptions = ( refObj: DimeEnvironmentSmartView, refField: DimeStreamFieldDetail ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewListAliasTables( refObj )
			.then( resEnv => { refObj = resEnv; return this.smartviewOpenDimension( refObj, refField ); } )
			.then( resEnv => { refObj = resEnv; return this.smartviewGetDescriptionsAction( refObj, refField ); } );
	}
	private smartviewOpenDimension = ( refObj: DimeEnvironmentSmartView, refField: DimeStreamFieldDetail ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewOpenApplication( refObj )
			.then( resEnv => {
				refObj = resEnv;
				// tslint:disable-next-line:max-line-length
				const body = '<req_OpenCube><sID>' + refObj.SID + '</sID><srv>' + refObj.planningserver + '</srv><app>' + refObj.database + '</app><cube>HSP_DIM_' + refField.name + '</cube><type></type><url></url><form></form></req_OpenCube>';
				return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } );
			} )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_opencube' ) { isSuccessful = true; }
				} );
				if ( isSuccessful ) {
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to open dimension ' + refObj.name + '@smartviewOpenDimension' ) );
				}
			} );
	}
	private smartviewGetDescriptionsAction = ( refObj: DimeEnvironmentSmartView, refField: DimeStreamFieldDetail ): Promise<DimeEnvironmentSmartView> => {
		const numberofColumns = 3; // Because columns are membername, description and desired aliastable name
		let body = '';
		body += '<req_ExecuteGrid>';
		body += '<sID>' + refObj.SID + '</sID>';
		body += '<action>zoomin</action>';
		body += '<ords>' + numberofColumns + '</ords>';
		body += '<preferences>';
		body += '<row_suppression zero="0" invalid="0" missing="0" underscore="0" noaccess="0"/>';
		body += '<celltext val="1"/>';
		body += '<zoomin ancestor="top" mode="descendents"/>';
		body += '<navigate withData="1"/>';
		body += '<includeSelection val="1"/>';
		body += '<repeatMemberLabels val="1"/>';
		body += '<withinSelectedGroup val="0"/>';
		body += '<removeUnSelectedGroup val="0"/>';
		body += '<col_suppression zero="0" invalid="0" missing="0" underscore="0" noaccess="0"/>';
		body += '<block_suppression missing="0"/>';
		body += '<includeDescriptionInLabel val="0"/>';
		body += '<missingLabelText val=""/>';
		body += '<noAccessText val="#No Access"/>';
		body += '<essIndent val="2"/>';
		body += '<sliceLimitation rows="1048576" cols="16384"/>';
		body += '</preferences>';
		body += '<grid>';
		body += '<cube>' + refObj.table + '</cube>';
		body += '<dims>';
		body += '<dim id="0" name="' + refField.name + '" row="0" hidden="0" expand="0"/>';
		body += '<dim id="1" name="Member Properties" col="0" hidden="0" expand="0"/>';
		body += '</dims>';
		body += '<perspective type="Reality"/>';
		body += '<slices>';
		body += '<slice rows="2" cols="' + numberofColumns + '">';
		body += '<data>';
		body += '<range start="0" end="' + ( numberofColumns * 2 - 1 ) + '">';
		body += '<vals>|Description|' + refField.descriptiveTable + ' Alias Table' + '|' + refField.name + '||</vals>';
		body += '<types>7|0|0|0|13|13</types>';
		body += '</range>';
		body += '</data>';
		body += '<metadata/>';
		body += '<conditionalFormats/>';
		body += '</slice>';
		body += '</slices>';
		body += '</grid>';
		body += '</req_ExecuteGrid>';
		return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_executegrid' ) { isSuccessful = true; }
				} );

				const rangeStart = parseInt( response.$( 'range' ).attr( 'start' ), 10 );

				if ( !isSuccessful ) {
					return Promise.reject( new Error( 'Failure to get descriptions ' + refObj.name + '@smartviewGetDescriptionsAction' ) );
				} else if ( rangeStart > 1 ) {
					return Promise.reject( new Error( 'Failure to get descriptions, wrong number returned for rangeStart ' + refObj.name + '@smartviewGetDescriptionsAction' ) );
				} else {
					const vals = response.$( 'vals' ).text().split( '|' );
					vals.splice( 0, ( numberofColumns - rangeStart ) );
					refObj.memberList = [];
					while ( vals.length ) {
						const curMemberArray = vals.splice( 0, numberofColumns );
						const curMember: { RefField: string, Description: string } = { RefField: curMemberArray[0], Description: curMemberArray[numberofColumns - 1] };
						if ( !curMember.Description ) { curMember.Description = curMemberArray[numberofColumns - 2]; }
						if ( !curMember.Description ) { curMember.Description = curMemberArray[0]; }
						refObj.memberList.push( curMember );
					}
					return Promise.resolve( refObj );
				}
			} );
	}
	public listAliasTables = ( refObj: DimeEnvironmentSmartView ) => {
		return this.smartviewListAliasTables( refObj ).then( result => result.aliastables.map( curTable => ( { name: curTable, type: 'Alias Table' } ) ) );
	}
	private smartviewListAliasTables = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewOpenCube( refObj )
			.then( resEnv => {
				refObj = resEnv;
				const body = '<req_EnumAliasTables><sID>' + refObj.SID + '</sID><ODL_ECID>0000</ODL_ECID></req_EnumAliasTables>';
				return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } );
			} )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_enumaliastables' ) { isSuccessful = true; }
				} );
				if ( isSuccessful ) {
					refObj.aliastables = response.$( 'alstbls' ).text().split( '|' );
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to list alias tables ' + refObj.name + '@smartviewListAliasTables' ) );
				}
			} );
	}
	public listDimensions = ( refObj: DimeEnvironmentSmartView ) => {
		return this.smartviewListDimensions( refObj ).then( result => result.dimensions );
	}
	private smartviewListDimensions = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewOpenCube( refObj )
			.then( resEnv => {
				refObj = resEnv;
				// tslint:disable-next-line:max-line-length
				const body = '<req_EnumDims><sID>' + refObj.SID + '</sID><srv>' + refObj.server + '</srv><app>' + refObj.database + '</app><cube>' + refObj.table + '</cube><alsTbl>Default</alsTbl><ODL_ECID>0000</ODL_ECID></req_EnumDims>';
				return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } );
			} )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_enumdims' ) { isSuccessful = true; }
				} );
				if ( isSuccessful ) {
					refObj.dimensions = [];
					response.$( 'dim' ).toArray().forEach( curDim => {
						refObj.dimensions.push( { name: curDim.attribs.name, type: ( curDim.attribs.type === 'None' ? 'Generic' : curDim.attribs.type ), isDescribed: 1 } );
					} );
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to list dimensions ' + refObj.name + '@smartviewListDimensions' ) );
				}
			} );
	}
	private smartviewOpenCube = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		let body: string;
		return this.smartviewListCubes( refObj )
			.then( resEnv => {
				refObj = resEnv;
				body = '<req_OpenCube><sID>' + refObj.SID + '</sID><srv>' + refObj.server + '</srv><app>' + refObj.database + '</app><cube>' + refObj.table + '</cube><type></type><url></url><form></form></req_OpenCube>';
				return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } );
			} )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_opencube' ) { isSuccessful = true; }
				} );
				if ( isSuccessful ) {
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to open cube ' + refObj.name + '@smartviewOpenCube' ) );
				}
			} );
	}
	public listCubes = ( refObj: DimeEnvironmentSmartView ) => {
		return this.smartviewListCubes( refObj ).then( result => Promise.resolve( result.cubes.map( curCube => ( { name: curCube, type: 'cube' } ) ) ) );
	}
	private smartviewListCubes = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		let body: string;
		return this.smartviewOpenApplication( refObj )
			.then( this.smartviewGetAvailableServices )
			.then( this.smartviewListDocuments )
			.then( resEnv => {
				refObj = resEnv;
				body = '<req_ListCubes><sID>' + refObj.SID + '</sID><srv>' + refObj.planningserver + '</srv><app>' + refObj.database + '</app><type></type><url></url></req_ListCubes>';
				return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } );
			} )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_listcubes' ) { isSuccessful = true; }
				} );
				if ( isSuccessful ) {
					refObj.cubes = response.$( 'cubes' ).text().split( '|' );
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to list cubes ' + refObj.name + '@smartviewListCubes@issuccessful' ) );
				}
			} );
	}
	private smartviewListDocuments = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		const body = '<req_ListDocuments><sID>' + refObj.SID + '</sID><type>all</type><folder>/</folder><ODL_ECID>0000</ODL_ECID></req_ListDocuments>';
		return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_listdocuments' ) { isSuccessful = true; }
				} );
				if ( isSuccessful ) {
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to list documents ' + refObj.name + '@smartviewListDocuments' ) );
				}
			} );
	}
	private smartviewGetAvailableServices = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		const body = '<req_GetAvailableServices><sID>' + refObj.SID + '</sID><app>' + refObj.database + '</app><CubeView/></req_GetAvailableServices>';
		return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_getavailableservices' ) { isSuccessful = true; }
				} );
				if ( isSuccessful ) {
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to get available services ' + refObj.name + '@smartviewGetAvailableServices' ) );
				}
			} );
	}
	private smartviewOpenApplication = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		let body: string;
		return this.smartviewListApplications( refObj )
			.then( resEnv => {
				refObj = resEnv;
				body = '<req_OpenApplication><sID>' + refObj.SID + '</sID><srv>' + refObj.planningserver + '</srv><app>' + refObj.database + '</app><type></type><url></url></req_OpenApplication>';
				return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } );
			} )
			.then( response => {
				let isSuccessful = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_openapplication' ) { isSuccessful = true; }
				} );
				if ( isSuccessful ) {
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to open application ' + refObj.name + '@smartviewOpenApplication' ) );
				}
			} );
	}
	public listApplications = ( refObj: DimeEnvironmentSmartView ) => {
		return this.smartviewListApplications( refObj ).then( result => Promise.resolve( result.applications ) );
	}
	public smartviewListApplications = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		// Validate SID function tries the smartviewListApplicationsValidator
		// If successful we have the applications listed in the response already
		// We made this so that we can avoid the circular reference
		return this.validateSID( refObj );
	}
	private smartviewListApplicationsValidator = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewListServers( refObj )
			.then( resEnv => {
				refObj = resEnv;
				const body = '<req_ListApplications><sID>' + refObj.SID + '</sID><srv>' + refObj.server + '</srv><type></type><url></url></req_ListApplications>';
				return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } );
			} )
			.then( response => {
				let isListed = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_listapplications' ) { isListed = true; }
				} );
				if ( isListed ) {
					refObj.applications = response.$( 'apps' ).text().split( '|' ).map( curApp => ( { name: curApp } ) );
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to list applications@smartviewListApplications' ) );
				}
			} );
	}
	public listServers = ( refObj: DimeEnvironmentSmartView ) => {
		return this.smartviewListServers( refObj ).then( result => Promise.resolve( result.planningserver ) );
	}
	public smartviewListServers = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewEstablishConnection( refObj )
			.then( resEnv => {
				refObj = resEnv;
				const body = '<req_ListServers><sID>' + refObj.SID + '</sID></req_ListServers>';
				return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } );
			} )
			.then( response => {
				let isListed = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_listservers' ) { isListed = true; }
				} );
				if ( isListed ) {
					refObj.planningserver = response.$( 'srvs' ).text();
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Failure to list servers@smartviewListServers' ) );
				}
			} );
	}
	public validateSID = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return new Promise( ( resolve, reject ) => {
			if ( refObj.SID ) {
				delete refObj.SID;
				delete refObj.cookies;
				resolve( this.validateSID( refObj ) );
			} else {
				switch ( refObj.type ) {
					case DimeEnvironmentType.PBCS: {
						// resolve( this.pbcsObtainSID( refObj ).then( this.smartviewListApplicationsValidator ) );
						this.pbcsObtainSID( refObj ).then( this.smartviewListApplicationsValidator ).then( resolve ).catch( reject );
						break;
					}
					case DimeEnvironmentType.HP: {
						this.hpObtainSID( refObj ).then( this.smartviewListApplicationsValidator ).then( resolve ).catch( reject );
						break;
					}
					default: {
						reject( new Error( 'Not a valid environment type' ) );
					}
				}
			}
		} );
	}
	private smartviewEstablishConnection = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return new Promise( ( resolve, reject ) => {
			this.smartviewEstablishConnectionAction( refObj )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 01:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 02:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 03:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 04:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 05:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 06:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 07:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 08:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 09:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 10:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 11:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.catch( ( failure: Error ) => { console.error( 'Establish connection failed 12:', refObj.name, failure.message ); return this.smartviewWaiter( refObj ).then( this.smartviewEstablishConnectionAction ); } )
				.then( resolve )
				.catch( reject );
		} );
	}
	private smartviewEstablishConnectionAction = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewPrepareEnvironment( refObj )
			.then( resEnv => {
				refObj = resEnv;
				let body = '<req_ConnectToProvider><ClientXMLVersion>4.2.5.6.0</ClientXMLVersion><lngs enc="0">en_US</lngs><usr></usr><pwd></pwd>';
				if ( refObj.ssotoken && refObj.type !== DimeEnvironmentType.PBCS ) { body += '<sso>' + refObj.ssotoken + '</sso>'; }
				body += '</req_ConnectToProvider>';
				return this.smartviewPoster( { url: refObj.planningurl, body, cookie: refObj.cookies } );
			} )
			.then( response => {
				let isConnectionEstablished = false;
				response.$( 'body' ).children().toArray().forEach( curElem => {
					if ( curElem.name === 'res_connecttoprovider' ) { isConnectionEstablished = true; }
				} );
				if ( isConnectionEstablished ) {
					return Promise.resolve( refObj );
				} else {
					return Promise.reject( new Error( 'Establish Connection - Failure to connect smartview provider: ' + refObj.name + '->' + response.body ) );
				}
			} );
	}
	private smartviewWaiter = ( refObj: DimeEnvironmentSmartView, timeToWait = 5000 ): Promise<DimeEnvironmentSmartView> => {
		return new Promise( ( resolve, reject ) => {
			setTimeout( () => { resolve( refObj ); }, timeToWait );
		} );
	}
	private smartviewPrepareEnvironment = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		refObj.smartviewurl = refObj.server + ':' + refObj.port + '/workspace/SmartViewProviders';
		refObj.planningurl = refObj.server + ':' + refObj.port + '/HyperionPlanning/SmartView';
		if ( !refObj.cookies ) { refObj.cookies = ''; }
		return Promise.resolve( refObj );
	}
	private hpObtainSID = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewEstablishConnection( refObj )
			.then( this.hpObtainSID01 )
			.then( this.hpObtainSID02 );
	}
	private hpObtainSID01 = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return new Promise( ( resolve, reject ) => {
			request.post( {
				url: refObj.smartviewurl,
				body: '<req_GetProvisionedDataSources><usr>' + refObj.username + '</usr><pwd>' + refObj.password + '</pwd><filters></filters></req_GetProvisionedDataSources>',
				headers: { 'Content-Type': 'application/xml' },
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					const $ = cheerio.load( body );
					$( 'Product' ).each( ( i: any, elem: any ) => {
						if ( $( elem ).attr( 'id' ) === 'HP' ) {
							refObj.planningurl = refObj.server + ':' + refObj.port + $( elem ).children( 'Server' ).attr( 'context' );
						}
					} );
					refObj.ssotoken = $( 'sso' ).text();
					if ( !refObj.planningurl ) {
						reject( new Error( 'No planning url could be identified ' + refObj.name + '@hpObtainSID01' ) );
					} else if ( !refObj.ssotoken ) {
						reject( new Error( 'No sso token was found ' + refObj.name + '@hpObtainSID01' ) );
					} else {
						resolve( refObj );
					}
				}
			} );
		} );
	}
	private hpObtainSID02 = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return new Promise( ( resolve, reject ) => {
			request.post( {
				url: refObj.planningurl,
				body: '<req_ConnectToProvider><ClientXMLVersion>4.2.5.6.0</ClientXMLVersion><lngs enc="0">en_US</lngs><sso>' + refObj.ssotoken + '</sso></req_ConnectToProvider>',
				headers: { 'Content-Type': 'application/xml' },
				timeout: 120000
			}, ( err, response, body ) => {
				const $ = cheerio.load( body );
				refObj.SID = $( 'sID' ).text();
				if ( refObj.SID ) {
					resolve( refObj );
				} else {
					reject( new Error( 'No SID found ' + refObj.name + '@hpObtainSID02' ) );
				}
			} );
		} );
	}
	private pbcsObtainSID = ( refObj: DimeEnvironmentSmartView ): Promise<DimeEnvironmentSmartView> => {
		return this.smartviewPrepareEnvironment( refObj )
			.then( this.pbcsObtainSID01 )
			.then( this.pbcsObtainSID02 )
			.then( this.pbcsObtainSID03 )
			.then( this.pbcsObtainSID04 )
			.then( this.pbcsObtainSID05 )
			.then( this.pbcsObtainSID06 )
			.then( this.pbcsObtainSID07 )
			.then( this.pbcsObtainSID08 )
			.then( this.pbcsObtainSID09 )
			.then( this.pbcsObtainSID10 );
	}
	private pbcsGetCookieString = ( sourceCookie: string | any, existingCookie?: string ) => {
		let targetCookie = '';
		if ( sourceCookie ) {
			if ( Array.isArray( sourceCookie ) ) {
				targetCookie = sourceCookie.join( '; ' );
			} else {
				targetCookie = sourceCookie;
			}
		}
		if ( existingCookie ) { targetCookie += existingCookie + '; ' + targetCookie; }
		return targetCookie;
	}
	private pbcsGetRequestContext = ( source: any ) => {
		let toReturn = '';
		if ( Array.isArray( source ) ) {
			if ( source ) {
				source.forEach( ( curSource: string ) => {
					if ( curSource.trim().substr( 0, 17 ) === 'OAMRequestContext' ) {
						toReturn = curSource.trim();
					}
				} );
			}
		}
		return toReturn;
	}
	private pbcsObtainSID01 = ( refObj: DimeEnvironmentSmartView ): Promise<{ refObj: DimeEnvironmentSmartView, refDetails: any }> => {
		return new Promise( ( resolve, reject ) => {
			const refDetails: any = {};
			refDetails.originalCookie = 'EPM_Remote_User=; ORA_EPMWS_User=' + encodeURIComponent( refObj.username ) + '; ORA_EPMWS_Locale=en_US; ORA_EPMWS_AccessibilityMode=false; ORA_EPMWS_ThemeSelection=Skyros';

			request.post( {
				url: refObj.smartviewurl,
				// tslint:disable-next-line:max-line-length
				body: '<req_ConnectToProvider><ClientXMLVersion>4.2.5.7.3</ClientXMLVersion><ClientInfo><ExternalVersion>11.1.2.5.710</ExternalVersion><OfficeVersion>16.0</OfficeVersion><OSVersion>Windows MajorVersion.MinorVersion.BuildNumber 10.0.15063</OSVersion></ClientInfo><lngs enc="0">en_US</lngs><usr></usr><pwd></pwd><sharedServices>1</sharedServices></req_ConnectToProvider >',
				headers: { 'Content-Type': 'application/xml', cookie: refDetails.originalCookie },
				followRedirect: false,
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					refDetails.redirectTarget = response.headers.location;
					refDetails.requestContext = this.pbcsGetRequestContext( response.headers['set-cookie'] );
					if ( refDetails.requestContext === '' ) {
						reject( new Error( 'No request context retrieved ' + refObj.name + '@pbcsObtainSID01' ) );
					} else {
						resolve( { refObj, refDetails } );
					}
				}
			} );
		} );
	}
	private pbcsObtainSID02 = ( refInfo: { refObj: DimeEnvironmentSmartView, refDetails: any } ): Promise<{ refObj: DimeEnvironmentSmartView, refDetails: any }> => {
		return new Promise( ( resolve, reject ) => {
			refInfo.refDetails.oamPrefsCookie = 'OAM_PREFS=dGVuYW50TmFtZT1rZXJ6bmVyfnJlbWVtYmVyVGVuYW50PXRydWV+cmVtZW1iZXJNZT1mYWxzZQ==';

			request.get( {
				url: refInfo.refDetails.redirectTarget,
				headers: { cookie: refInfo.refDetails.oamPrefsCookie },
				followRedirect: false,
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					resolve( refInfo );
				}
			} );
		} );
	}
	private pbcsObtainSID03 = ( refInfo: { refObj: DimeEnvironmentSmartView, refDetails: any } ): Promise<{ refObj: DimeEnvironmentSmartView, refDetails: any }> => {
		return new Promise( ( resolve, reject ) => {
			request.get( {
				url: refInfo.refObj.server + ':' + refInfo.refObj.port + '/workspace/SmartViewProviders',
				headers: {
					cookie: refInfo.refDetails.originalCookie + '; ' + refInfo.refDetails.requestContext
				},
				followRedirect: false,
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					refInfo.refDetails.redirectTarget = response.headers.location;
					if ( this.pbcsGetRequestContext( response.headers['set-cookie'] ) ) {
						refInfo.refDetails.requestContext += '; ' + this.pbcsGetRequestContext( response.headers['set-cookie'] );
					}
					if ( refInfo.refDetails.requestContext === '' ) {
						reject( new Error( 'No request context retrieved ' + refInfo.refObj.name + '@pbcsObtainSID03' ) );
					} else {
						refInfo.refDetails.encquery = url.parse( refInfo.refDetails.redirectTarget ).search;
						resolve( refInfo );
					}
				}
			} );
		} );
	}
	private pbcsObtainSID04 = ( refInfo: { refObj: DimeEnvironmentSmartView, refDetails: any } ): Promise<{ refObj: DimeEnvironmentSmartView, refDetails: any }> => {
		return new Promise( ( resolve, reject ) => {
			request.get( {
				url: refInfo.refDetails.redirectTarget,
				headers: {
					cookie: refInfo.refDetails.oamPrefsCookie
				},
				followRedirect: false,
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					const $ = cheerio.load( response.body );
					refInfo.refDetails.formFields = {};
					$( 'input' ).each( ( i: any, elem: any ) => {
						if ( $( elem.parent ).attr( 'name' ) === 'signin_form' ) {
							refInfo.refDetails.formFields[$( elem ).attr( 'name' )] = $( elem ).val();
						}
					} );

					$( 'form' ).each( ( i: any, elem: any ) => {
						if ( $( elem ).attr( 'name' ) === 'signin_form' ) {
							refInfo.refDetails.formAction = response.request.uri.protocol + '//' + response.request.uri.hostname + $( elem ).attr( 'action' );
						}
					} );

					refInfo.refDetails.formFields.username = refInfo.refObj.username;
					refInfo.refDetails.formFields.password = refInfo.refObj.password;
					refInfo.refDetails.formFields.userid = refInfo.refObj.username;
					refInfo.refDetails.formFields.tenantDisplayName = refInfo.refObj.identitydomain;
					refInfo.refDetails.formFields.tenantName = refInfo.refObj.identitydomain;

					refInfo.refDetails.formCookie = this.pbcsGetCookieString( response.headers['set-cookie'] );
					if ( refInfo.refDetails.formAction ) {
						resolve( refInfo );
					} else {
						reject( new Error( 'Form action is not set ' + refInfo.refObj.name + '@pbcsObtainSID04' ) );
					}
				}
			} );
		} );
	}
	private pbcsObtainSID05 = ( refInfo: { refObj: DimeEnvironmentSmartView, refDetails: any } ): Promise<{ refObj: DimeEnvironmentSmartView, refDetails: any }> => {
		return new Promise( ( resolve, reject ) => {
			request.post( {
				url: refInfo.refDetails.formAction,
				headers: {
					referer: refInfo.refDetails.redirectTarget,
					cookie: refInfo.refDetails.oamPrefsCookie + '; ' + refInfo.refDetails.formCookie,
				},
				form: refInfo.refDetails.formFields,
				followRedirect: false,
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					refInfo.refDetails.formResponseCookie = this.pbcsGetCookieString( response.headers['set-cookie'] );
					refInfo.refDetails.redirectTarget = response.headers.location;
					refInfo.refDetails.referer = refInfo.refDetails.formAction + refInfo.refDetails.encquery;
					resolve( refInfo );
				}
			} );
		} );
	}
	private pbcsObtainSID06 = ( refInfo: { refObj: DimeEnvironmentSmartView, refDetails: any } ): Promise<{ refObj: DimeEnvironmentSmartView, refDetails: any }> => {
		return new Promise( ( resolve, reject ) => {
			request.get( {
				url: refInfo.refDetails.redirectTarget,
				headers: {
					cookie: refInfo.refDetails.originalCookie + '; ' + refInfo.refDetails.requestContext,
					referer: refInfo.refDetails.referer
				},
				followRedirect: false,
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					refInfo.refDetails.currentCookie = refInfo.refDetails.originalCookie + '; ' + this.pbcsGetCookieString( response.headers['set-cookie'] );
					refInfo.refDetails.redirectTarget = refInfo.refObj.server + response.headers.location;
					resolve( refInfo );
				}
			} );
		} );
	}
	private pbcsObtainSID07 = ( refInfo: { refObj: DimeEnvironmentSmartView, refDetails: any } ): Promise<{ refObj: DimeEnvironmentSmartView, refDetails: any }> => {
		return new Promise( ( resolve, reject ) => {
			request.get( {
				url: refInfo.refDetails.redirectTarget,
				headers: {
					cookie: refInfo.refDetails.currentCookie,
					referer: refInfo.refDetails.referer
				},
				followRedirect: false,
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					refInfo.refDetails.currentCookie = refInfo.refDetails.currentCookie + '; ' + this.pbcsGetCookieString( response.headers['set-cookie'] );
					resolve( refInfo );
				}
			} );
		} );
	}
	private pbcsObtainSID08 = ( refInfo: { refObj: DimeEnvironmentSmartView, refDetails: any } ): Promise<{ refObj: DimeEnvironmentSmartView, refDetails: any }> => {
		return new Promise( ( resolve, reject ) => {
			request.post( {
				url: refInfo.refDetails.redirectTarget,
				headers: {
					'Content-Type': 'application/xml',
					cookie: refInfo.refDetails.currentCookie
				},
				// tslint:disable-next-line:max-line-length
				body: '<req_ConnectToProvider><ClientXMLVersion>4.2.5.7.3</ClientXMLVersion><ClientInfo><ExternalVersion>11.1.2.5.710</ExternalVersion><OfficeVersion>16.0</OfficeVersion><OSVersion>Windows MajorVersion.MinorVersion.BuildNumber 10.0.15063</OSVersion></ClientInfo><lngs enc="0">en_US</lngs><usr></usr><pwd></pwd><sharedServices>1</sharedServices></req_ConnectToProvider >',
				followRedirect: false,
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					resolve( refInfo );
				}
			} );
		} );
	}
	private pbcsObtainSID09 = ( refInfo: { refObj: DimeEnvironmentSmartView, refDetails: any } ): Promise<{ refObj: DimeEnvironmentSmartView, refDetails: any }> => {
		return new Promise( ( resolve, reject ) => {
			request.post( {
				url: refInfo.refDetails.redirectTarget,
				headers: {
					'Content-Type': 'application/xml',
					cookie: refInfo.refDetails.currentCookie
				},
				body: '<req_GetProvisionedDataSources><usr></usr><pwd></pwd><filters></filters></req_GetProvisionedDataSources>',
				followRedirect: false,
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					const $ = cheerio.load( body );
					$( 'Product' ).each( ( i: any, elem: any ) => {
						if ( $( elem ).attr( 'id' ) === 'HP' ) {
							refInfo.refObj.planningurl = refInfo.refObj.server + ':' + refInfo.refObj.port + $( elem ).children( 'Server' ).attr( 'context' );
						}
					} );
					refInfo.refObj.ssotoken = $( 'sso' ).text();
					if ( !refInfo.refObj.planningurl ) {
						reject( new Error( 'No planning url could be identified ' + refInfo.refObj.name + '@pbcsObtainSID09' ) );
					} else if ( !refInfo.refObj.ssotoken ) {
						reject( new Error( 'No sso token was found ' + refInfo.refObj.name + '@pbcsObtainSID09' ) );
					} else {
						resolve( refInfo );
					}
				}
			} );
		} );
	}
	private pbcsObtainSID10 = ( refInfo: { refObj: DimeEnvironmentSmartView, refDetails: any } ): Promise<DimeEnvironmentSmartView> => {
		return new Promise( ( resolve, reject ) => {
			request.post( {
				url: refInfo.refObj.planningurl,
				body: '<req_ConnectToProvider><ClientXMLVersion>4.2.5.6.0</ClientXMLVersion><lngs enc="0">en_US</lngs><sso>' + refInfo.refObj.ssotoken + '</sso></req_ConnectToProvider>',
				headers: { 'Content-Type': 'application/xml', cookie: refInfo.refDetails.currentCookie },
				timeout: 120000
			}, ( err, response, body ) => {
				if ( err ) {
					reject( err );
				} else {
					const $ = cheerio.load( body );
					refInfo.refObj.SID = $( 'sID' ).text();
					refInfo.refObj.cookies = refInfo.refDetails.currentCookie;
					if ( refInfo.refObj.SID ) {
						resolve( refInfo.refObj );
					} else {
						reject( new Error( 'No SID found ' + refInfo.refObj.name + '@pbcsObtainSID10' ) );
					}
				}
			} );
		} );
	}

	private smartviewRequester = ( options: SmartViewRequestOptions ): Promise<{ body: any, $: CheerioStatic, options: SmartViewRequestOptions }> => {
		return new Promise( ( resolve, reject ) => {
			const requestOptions: any = {};
			requestOptions.url = options.url;
			requestOptions.method = options.method;
			requestOptions.body = options.body;
			requestOptions.headers = { 'Content-Type': 'application/xml' };
			if ( options.contentType ) { requestOptions.headers['Content-Type'] = options.contentType; }
			if ( options.cookie ) { requestOptions.headers.cookie = options.cookie; }
			requestOptions.timeout = 120000;
			if ( options.timeout ) { requestOptions.timeout = options.timeout; }
			request( requestOptions, ( err: Error, response: any, body: any ) => {
				if ( err ) {
					reject( err );
				} else {
					try {
						resolve( { body, $: cheerio.load( body ), options } );
					} catch ( error ) {
						reject( error );
					}
				}
			} );
		} );
	}
	private smartviewPoster = ( options: SmartViewRequestOptions ) => {
		return this.smartviewRequester( Object.assign( { method: 'POST' }, options ) );
	}
	private smartviewGetter = ( options: SmartViewRequestOptions ) => {
		return this.smartviewRequester( Object.assign( { method: 'GET' }, options ) );
	}
}
