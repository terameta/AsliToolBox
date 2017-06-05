import { IPool } from 'mysql';

import { MainTools } from '../config/config.tools';
import { StreamTools } from './tools.dime.stream';

import { DimeMap } from '../../shared/model/dime/map';
import { DimeStream } from '../../shared/model/dime/stream';
import { DimeStreamField } from '../../shared/model/dime/streamfield';
import { EnvironmentTools } from './tools.dime.environment';
import { DimeEnvironment } from '../../shared/model/dime/environment';

export class MapTools {
	private streamTool: StreamTools;
	private environmentTool: EnvironmentTools;
	constructor(
		public db: IPool,
		public tools: MainTools) {
		this.streamTool = new StreamTools(this.db, this.tools);
		this.environmentTool = new EnvironmentTools(this.db, this.tools);
	}

	public getAll = () => {
		return new Promise((resolve, reject) => {
			this.db.query('SELECT * FROM maps', (err, rows, fields) => {
				if (err) {
					reject({ error: err, message: 'Failed to get maps.' });
				} else {
					resolve(rows);
				}
			})
		});
	}
	public getOne = (id: number) => {
		return new Promise((resolve, reject) => {
			this.db.query('SELECT * FROM maps WHERE id = ?', id, (err, rows, fields) => {
				if (err) {
					reject({ error: err, message: 'Failed to get map' });
				} else if (rows.length !== 1) {
					reject({ error: 'Wrong number of records', message: 'Wrong number of records for map received from the server, 1 expected' });
				} else {
					resolve(rows[0]);
				}
			});
		});
	}
	public create = () => {
		return new Promise((resolve, reject) => {
			let newMap: any = {};
			newMap = { name: 'New Map' };
			this.db.query('INSERT INTO maps SET ?', { name: 'New Map' }, (err, rows, fields) => {
				if (err) {
					reject({ error: err, message: 'Failed to create a new map.' });
				} else {
					newMap.id = rows.insertId;
					resolve(newMap);
				}
			})
		});
	}
	public update = (dimeMap: DimeMap) => {
		return new Promise((resolve, reject) => {
			this.db.query('UPDATE maps SET ? WHERE id = ?', [dimeMap, dimeMap.id], (err, rows, fields) => {
				if (err) {
					reject({ error: err, message: 'Failed to update the map.' });
				} else {
					resolve(dimeMap);
				}
			})
		});
	}
	public delete = (id: number) => {
		return new Promise((resolve, reject) => {
			this.db.query('DELETE FROM maps WHERE id = ?', id, (err, rows, fields) => {
				if (err) {
					reject({ error: err, message: 'Failed to delete the map.' });
				} else {
					resolve(id);
				}
			})
		});
	}
	public getFields = (id: number) => {
		return new Promise((resolve, reject) => {
			this.db.query('SELECT * FROM mapfields WHERE map = ?', id, (err, rows, fields) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			})
		});
	}
	public setFields = (refObj: { map: number, type: string, list: string[] }) => {
		return new Promise((resolve, reject) => {
			if (!refObj) {
				reject('No information passed.');
			} else if (!refObj.map) {
				reject('No map id passed.');
			} else if (!refObj.type) {
				reject('No type passed.');
			} else if (!refObj.list) {
				reject('No list passed.');
			} else if (!Array.isArray(refObj.list)) {
				reject('Provided list is not correctly formatted.');
			} else if (refObj.list.length < 1) {
				reject('Provided list is empty.');
			} else {
				this.db.query('DELETE FROM mapfields WHERE map = ? AND srctar = ?', [refObj.map, refObj.type], (err, rows, fields) => {
					if (err) {
						reject(err);
					} else {
						let promises: any[];
						promises = [];
						refObj.list.forEach((curField) => {
							promises.push(this.setFieldsAction(refObj.map, curField, refObj.type));
						});
						Promise.all(promises).then(resolve).catch(reject);
					}
				})
			}
		});
	}
	private setFieldsAction = (id: number, field: string, type: string) => {
		return new Promise((resolve, reject) => {
			this.db.query('INSERT INTO mapfields SET ?', { map: id, srctar: type, name: field }, (err, rows, fields) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			})
		});
	}
	public prepare = (id: number) => {
		return new Promise((resolve, reject) => {
			this.prepareFields(id).
				then((refObj: any) => {
					let createQueries: any;
					createQueries = {};
					createQueries.maptbl = 'CREATE TABLE MAP' + refObj.id + '_MAPTBL (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT';
					createQueries.drops = [];
					createQueries.drops.push('DROP TABLE IF EXISTS MAP' + refObj.id + '_MAPTBL');
					refObj.fields.forEach((curField: any) => {
						let curPrefix = '';
						let curFieldDef = '';
						if (curField.srctar === 'source') { curPrefix = 'SRC_'; }
						if (curField.srctar === 'target') { curPrefix = 'TAR_'; }
						curFieldDef = ', ' + curPrefix + curField.name;
						if (curField.type === 'string' && (curField.environmentType === 'RDBT' || curField.environmentType === 'RDBS')) {
							curFieldDef += ' VARCHAR(' + curField.fCharacters + ')';
						}
						if (curField.type === 'number' && (curField.environmentType === 'RDBT' || curField.environmentType === 'RDBS')) {
							curFieldDef += ' NUMERIC(' + curField.fPrecision + ',' + curField.fDecimals + ')';
						}
						if (curField.type === 'date' && (curField.environmentType === 'RDBT' || curField.environmentType === 'RDBS')) {
							curFieldDef += ' DATETIME';
						}
						if (curField.environmentType === 'HPDB') {
							curFieldDef += ' VARCHAR(80)';
						}
						if (curField.mappable) { createQueries.maptbl += curFieldDef + ', INDEX (' + curPrefix + curField.name + ')'; }
						// if (curField.isDescribed === 1 && curField.mappable) {
						// 	createQueries.drops.push('DROP TABLE IF EXISTS MAP' + refObj.id + '_DESCTBL' + curField.id + ';');
						// 	let curQuery: string;
						// 	curQuery = 'CREATE TABLE MAP' + refObj.id + '_DESCTBL' + curField.id + ' (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT';
						// 	curQuery += ', ' + curPrefix + curField.name;
						// 	if (curField.drfType === 'string') {
						// 		curQuery += ' VARCHAR(' + curField.drfCharacters + ')';
						// 	}
						// 	if (curField.drfType === 'number') {
						// 		curQuery += ' NUMERIC(' + curField.drfPrecision + ', ' + curField.drfDecimals + ')';
						// 	}
						// 	if (curField.drfType === 'date') {
						// 		curQuery += ' DATETIME';
						// 	}
						// 	if (curField.ddfType === 'string') {
						// 		curQuery += ', Description VARCHAR(' + curField.ddfCharacters + ')';
						// 	}
						// 	if (curField.ddfType === 'number') {
						// 		curQuery += ', Description NUMERIC(' + curField.ddfPrecision + ',' + curField.ddfDecimals + ')';
						// 	}
						// 	if (curField.ddfType === 'date') {
						// 		curQuery += ', Description DATETIME';
						// 	}
						// 	curQuery += ', PRIMARY KEY(id) );';
						// 	createQueries['DESCTBL' + curField.id] = curQuery;
						// }
						// if (curField.environmentType === 'HPDB' && curField.mappable) {
						// 	createQueries.drops.push('DROP TABLE IF EXISTS MAP' + refObj.id + '_DESCTBL' + curField.id + ';');
						// 	let curQuery: string;
						// 	curQuery = 'CREATE TABLE MAP' + refObj.id + '_DESCTBL' + curField.id + ' (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT';
						// 	curQuery += ', ' + curPrefix + curField.name + ' VARCHAR(255)';
						// 	curQuery += ', Description VARCHAR(1024)';
						// 	curQuery += ', PRIMARY KEY(id) );';
						// 	createQueries['DESCTBL' + curField.id] = curQuery;
						// }
					});
					createQueries.maptbl += ', PRIMARY KEY(id) );';
					refObj.queries = createQueries;
					return refObj;
				}).
				then((refObj: any) => {
					return new Promise((tResolve, tReject) => {
						let promises: any[];
						promises = [];
						refObj.queries.drops.forEach((curQuery: any) => {
							promises.push(new Promise((iresolve, ireject) => {
								this.db.query(curQuery, function (err, rows, fields) {
									if (err) {
										ireject(err);
									} else {
										iresolve(rows);
									}
								});
							}));
						});
						Promise.all(promises).then(function (result) {
							tResolve(refObj);
						}).catch(tReject);
					});
				}).
				then((refObj: any) => {
					return new Promise((tResolve, tReject) => {
						delete refObj.queries.drops;
						let promises: any[];
						promises = [];
						Object.keys(refObj.queries).forEach((curQuery) => {
							promises.push(new Promise((iresolve, ireject) => {
								this.db.query(refObj.queries[curQuery], function (err, rows, fields) {
									if (err) {
										ireject(err);
									} else {
										iresolve(rows);
									}
								});
							}));
						});
						Promise.all(promises).then(function (result) {
							tResolve(refObj);
						}).catch(tReject);
					});
				}).
				then(() => {
					resolve({ result: 'OK' });
				}).
				catch(reject);
		});
	}
	private prepareFields = (id: number) => {
		let refObj: any;
		refObj = {};
		return new Promise((resolve, reject) => {
			this.getOne(id).
				then((curMap: DimeMap) => {
					refObj = curMap;
					return this.streamTool.getOne(refObj.source);
				}).
				then((sourceStream: DimeStream) => {
					refObj.sourceDetails = sourceStream;
					return this.streamTool.getOne(refObj.target);
				}).
				then((targetStream: DimeStream) => {
					refObj.targetDetails = targetStream;
					return this.streamTool.retrieveFields(refObj.source);
				}).
				then((sourceStreamFields) => {
					refObj.sourceFields = sourceStreamFields;
					return this.streamTool.retrieveFields(refObj.target);
				}).
				then((targetStreamFields) => {
					refObj.targetFields = targetStreamFields;
					return this.getFields(refObj.id);
				}).
				then((mapFields) => {
					refObj.mapFields = mapFields;
					return this.streamTool.listTypes();
				}).
				then((streamTypes: any[]) => {
					streamTypes.forEach((curType) => {
						if (curType.id === refObj.sourceDetails.type) {
							refObj.sourceDetails.typeName = curType.name;
							refObj.sourceDetails.typeValue = curType.value;
						}
						if (curType.id === refObj.targetDetails.type) {
							refObj.targetDetails.typeName = curType.name;
							refObj.targetDetails.typeValue = curType.value;
						}
					});
					return refObj;
				}).
				then(() => {
					refObj.fields = [];
					refObj.sourceFields.sort(this.fieldSort);
					refObj.targetFields.sort(this.fieldSort);
					refObj.sourceFields.forEach((curField: any) => {
						curField.srctar = 'source';
						curField.environmentType = refObj.sourceDetails.typeValue;
						refObj.fields.push(curField);
					});
					refObj.targetFields.forEach((curField: any) => {
						curField.srctar = 'target';
						curField.environmentType = refObj.targetDetails.typeValue;
						refObj.fields.push(curField);
					});
					refObj.fields.forEach((curField: any) => {
						curField.mappable = false;
						refObj.mapFields.forEach((curMapField: any) => {
							if (curMapField.srctar === curField.srctar && curMapField.name === curField.name) {
								curField.mappable = true;
							}
						})
					});
					return refObj;
				}).
				then(resolve).
				catch(reject);
		});
	};
	private fieldSort(a: any, b: any) {
		if (a.fOrder < b.fOrder) {
			return -1;
		} else if (a.fOrder > b.fOrder) {
			return 1;
		} else {
			return 0;
		}
	}
	public isReady = (id: number) => {
		return new Promise((resolve, reject) => {
			let maptblExists: boolean; maptblExists = false;
			let descriptivetblExists: any; descriptivetblExists = {};
			const systemDBName = this.tools.config.mysql.db;
			this.prepareFields(id).
				then((refObj: any) => {
					this.db.query('SELECT * FROM information_schema.tables WHERE table_schema = ? AND table_name LIKE ?', [systemDBName, 'MAP' + refObj.id + '_%'], (err, rows, fields) => {
						if (err) {
							reject(err);
						} else if (rows.length === 0) {
							resolve({ result: 'NO' });
						} else {
							rows.forEach((curTable: any) => {
								if (curTable.TABLE_NAME === 'MAP' + refObj.id + '_MAPTBL') { maptblExists = true; }
							});
							let numSrcFields = 0;
							let numTarFields = 0;
							refObj.mapFields.forEach((curField: any) => {
								if (curField.srctar === 'source') { numSrcFields++; }
								if (curField.srctar === 'target') { numTarFields++; }
							})
							if (maptblExists && numSrcFields > 0 && numTarFields > 0) {
								resolve({ result: 'YES' });
							} else {
								resolve({ result: 'NO' });
							}
						}
					});

				});
		});
	};
	public rejectIfNotReady = (id: number) => {
		return new Promise((resolve, reject) => {
			this.isReady(id).
				then((isReady: { result: string }) => {
					if (isReady.result === 'YES') {
						resolve(id);
					} else {
						reject('Map is not ready');
					}
				}).
				catch(reject);
		});
	}
	public retrieveMapData = (refObj: { map: number }) => {
		return new Promise((resolve, reject) => {
			// tslint:disable-next-line:prefer-const
			let curMap: DimeMap; curMap = { id: 0, name: '' };
			let mapFields: any[]; mapFields = [];
			let finalFields: any[]; finalFields = [];
			let sourceFields: DimeStreamField[]; sourceFields = [];
			let targetFields: DimeStreamField[]; targetFields = [];
			let sourceStream: DimeStream; sourceStream = { id: 0, name: '', type: 0, environment: 0 };
			let targetStream: DimeStream; targetStream = { id: 0, name: '', type: 0, environment: 0 };
			let sourceEnvironment: DimeEnvironment; sourceEnvironment = { id: 0 };
			let targetEnvironment: DimeEnvironment; targetEnvironment = { id: 0 };

			this.getOne(refObj.map).
				then((theMap: DimeMap) => {
					curMap = theMap;
					console.log(new Date(), 'Received map');
					return this.streamTool.retrieveFields(curMap.source || 0);
				}).
				then((srcFields: DimeStreamField[]) => {
					console.log(new Date(), 'Received source fields');
					sourceFields = srcFields;
					return this.streamTool.retrieveFields(curMap.target || 0);
				}).
				then((tarFields: DimeStreamField[]) => {
					console.log(new Date(), 'Received target fields');
					targetFields = tarFields;
					return this.streamTool.getOne(curMap.source || 0);
				}).
				then((srcStream: DimeStream) => {
					console.log(new Date(), 'Received source stream');
					sourceStream = srcStream;
					return this.streamTool.getOne(curMap.target || 0);
				}).
				then((tarStream: DimeStream) => {
					console.log(new Date(), 'Received target stream');
					targetStream = tarStream;
					return this.environmentTool.getEnvironmentDetails({ id: sourceStream.environment }).then(this.environmentTool.getTypeDetails);
				}).
				then((srcEnvironment: DimeEnvironment) => {
					console.log(new Date(), 'Received source environment');
					sourceEnvironment = srcEnvironment;
					return this.environmentTool.getEnvironmentDetails({ id: targetStream.environment }).then(this.environmentTool.getTypeDetails);
				}).
				then((tarEnvironment: DimeEnvironment) => {
					console.log(new Date(), 'Received target environment');
					targetEnvironment = tarEnvironment;
					return this.getFields(curMap.id);
				}).
				then((mapFieldList: any) => {
					mapFields = mapFieldList;
					return 'OK';
				}).
				then(() => {
					if (sourceEnvironment.typedetails === undefined) {
						reject('Source environment details are not valid.');
					} else if (!targetEnvironment.typedetails) {
						reject('Target environment details are not valid.');
					} else {
						sourceFields.forEach((curField) => {
							mapFields.forEach((mapField) => {
								if (sourceEnvironment.typedetails && mapField.srctar === 'source' && mapField.name === curField.name) {
									console.log(curField.name, curField.isDescribed, sourceEnvironment.typedetails.value);
									finalFields.push({
										id: curField.id, name: curField.name, srctar: mapField.srctar, type: 'main', table: 'MAP' + curMap.id + '_MAPTBL'
									});
									if (curField.isDescribed || sourceEnvironment.typedetails.value === 'HP') {
										finalFields.push({ id: curField.id, name: curField.name, srctar: mapField.srctar, type: 'description', table: 'STREAM' + sourceStream.id + '_DESCTBL' + curField.id });
									}
								}
							});
						});
						targetFields.forEach((curField) => {
							mapFields.forEach((mapField) => {
								if (targetEnvironment.typedetails && mapField.srctar === 'target' && mapField.name === curField.name) {
									console.log(curField.name, curField.isDescribed, targetEnvironment.typedetails.value);
									finalFields.push({ id: curField.id, name: curField.name, srctar: mapField.srctar, type: 'main', table: 'MAP' + curMap.id + '_MAPTBL' });
									if (curField.isDescribed || targetEnvironment.typedetails.value === 'HP') {
										finalFields.push({ id: curField.id, name: curField.name, srctar: mapField.srctar, type: 'description', table: 'STREAM' + targetStream.id + '_DESCTBL' + curField.id });
									}
								}
							});
						});
						// console.log(curMap);
						// console.log(mapFields);
						finalFields.forEach((curField) => {
							console.log(curField);
						});
						let selectQuery: string; selectQuery = '';
						selectQuery += 'SELECT MAP' + curMap.id + '_MAPTBL.id, ';
						selectQuery += finalFields.map((curField) => {
							let toReturn: string; toReturn = '\n\t';
							if (curField.type === 'main') {
								toReturn += curField.table + '.';
								toReturn += curField.srctar === 'source' ? 'SRC_' : 'TAR_';
								toReturn += curField.name;
							} else {
								toReturn += curField.table + '.Description';
								toReturn += ' AS ';
								toReturn += curField.srctar === 'source' ? 'SRC_' : 'TAR_';
								toReturn += curField.name;
								toReturn += '_DESC';
							}
							return toReturn;
						}).join(', ');
						selectQuery += '\n FROM MAP' + curMap.id + '_MAPTBL ';
						finalFields.forEach((curField) => {
							if (curField.type === 'description') {
								selectQuery += '\n\t' + 'LEFT JOIN ';
								selectQuery += curField.table;
								selectQuery += ' ON ';
								selectQuery += 'MAP' + curMap.id + '_MAPTBL.' + (curField.srctar === 'source' ? 'SRC_' : 'TAR_') + curField.name;
								selectQuery += ' = ';
								selectQuery += curField.table + '.RefField';
							}
						});
						console.log(selectQuery);
						this.db.query(selectQuery, (err, result, fields) => {
							if (err) {
								reject(err);
							} else {
								const toReturn = {
									map: result
								};
								// console.log(result);
								resolve(toReturn);
							}
						});
					}
				}).
				catch(reject);
		});
	}
}
