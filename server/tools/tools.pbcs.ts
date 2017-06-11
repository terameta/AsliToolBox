import * as request from 'request';
import * as xml2js from 'xml2js';
import * as async from 'async';
const cheerio = require('cheerio');

import { DimeEnvironmentPBCS } from '../../shared/model/dime/environmentPBCS';
import { MainTools } from './tools.main';

export class PBCSTools {
	xmlParser: any;

	constructor(public tools: MainTools) {
		this.xmlParser = xml2js.parseString;
	}

	public verify = (refObj: DimeEnvironmentPBCS) => {
		return this.initiateRest(refObj);

	};
	private initiateRest = (refObj: DimeEnvironmentPBCS) => {
		return this.staticVerify(refObj).
			then(this.pbcsGetVersion);
	}
	private staticVerify = (refObj: DimeEnvironmentPBCS) => {
		return new Promise((resolve, reject) => {
			if (!refObj) {
				reject('No data provided');
			} else if (!refObj.username) {
				reject('No username provided');
			} else if (!refObj.password) {
				reject('No password provided');
			} else if (!refObj.server) {
				reject('No server is provided');
			} else if (!refObj.port) {
				reject('No port is provided');
			} else if (refObj.server.substr(0, 4) !== 'http') {
				reject('Server address is not valid. Make sure it starts with http:// or https://');
			} else {
				refObj.address = refObj.server + ':' + refObj.port;
				refObj.resturl = refObj.address + '/HyperionPlanning/rest';
				refObj.smartviewurl = refObj.address + '/workspace/SmartViewProviders';
				resolve(refObj);
			}
		});
	};
	private pbcsGetVersion = (refObj: DimeEnvironmentPBCS) => {
		// console.log(refObj.resturl);
		return new Promise((resolve, reject) => {
			request.get({
				url: refObj.resturl + '/',
				auth: {
					user: refObj.username,
					pass: refObj.password,
					sendImmediately: true
				},
				headers: { 'Content-Type': 'application/json' }
			}, (err, response: request.RequestResponse, body) => {
				if (err) {
					reject(err);
				} else {
					this.tools.parseJsonString(body).
						then((result: any) => {
							if (!result.items) {
								reject('No version items');
							} else {
								result.items.forEach((curItem: any) => {
									if (curItem.lifecycle === 'active') {
										refObj.version = curItem.version
										refObj.resturl += '/' + refObj.version;
									}
								});
								if (refObj.version) {
									// console.log(refObj);
									resolve(refObj);
								} else {
									reject('No active version found');
								}
							}
						}).
						catch(reject);
				}
			});
		});
	}
	public listApplications = (refObj: DimeEnvironmentPBCS) => {
		return new Promise((resolve, reject) => {
			this.pbcsGetApplications(refObj).
				then((innerObj: DimeEnvironmentPBCS) => {
					resolve(innerObj.apps);
				}).
				catch(reject);
		});
	}
	private pbcsGetApplications = (refObj: DimeEnvironmentPBCS) => {
		return new Promise((resolve, reject) => {
			this.initiateRest(refObj).
				then((innerObj: DimeEnvironmentPBCS) => {
					request.get({
						url: innerObj.resturl + '/applications',
						auth: {
							user: innerObj.username,
							pass: innerObj.password,
							sendImmediately: true
						},
						headers: { 'Content-Type': 'application/json' }
					}, (err, response, body) => {
						if (err) {
							reject(err);
						} else {
							this.tools.parseJsonString(body).
								then((result: any) => {
									if (!result) {
										reject('No response received at pbcsGetApplications');
									} else if (!result.items) {
										reject('No items received at pbcsGetApplications');
									} else {
										innerObj.apps = [];
										result.items.forEach((curItem: any) => {
											if (innerObj.apps) { innerObj.apps.push({ name: curItem.name }); }
										});
										console.log(result);
										resolve(innerObj);
									}
								}).
								catch(reject);
						}
					});
				}).
				catch(reject);
		});
	}
	public listCubes = (refObj: DimeEnvironmentPBCS) => {
		return new Promise((resolve, reject) => {
			this.pbcsGetCubes(refObj).
				then((innerObj: DimeEnvironmentPBCS) => {
					reject('Not yet');
				}).
				catch(reject);
		});
	}
	private pbcsGetCubes = (refObj: DimeEnvironmentPBCS) => {
		return new Promise((resolve, reject) => {
			this.initiateRest(refObj).
				then((innerObj: DimeEnvironmentPBCS) => {
					request.get({
						url: innerObj.resturl + '/applications/' + innerObj.database + '/',
						auth: {
							user: innerObj.username,
							pass: innerObj.password,
							sendImmediately: true
						},
						headers: { 'Content-Type': 'application/json' }
					}, (err, response, body) => {
						if (err) {
							reject(err);
						} else {
							console.log(response);
							this.tools.parseJsonString(body).
								then((result: any) => {
									console.log(result);
									reject('Hdere');
								}).
								catch(reject);
						}
					});
				}).
				catch(reject);
		});
	};
	public listRules = (refObj: DimeEnvironmentPBCS) => {
		return new Promise((resolve, reject) => {
			console.log('!!!!!!!!!!!!');
			console.log('Update this part of the tools.pbcs.ts file');
			console.log('!!!!!!!!!!!!');
			reject('Update this part of the tools.pbcs.ts file');
		});
	};
	public listRuleDetails = (refObj: DimeEnvironmentPBCS) => {
		return new Promise((resolve, reject) => {
			console.log('!!!!!!!!!!!!');
			console.log('Update this part of the tools.pbcs.ts file');
			console.log('!!!!!!!!!!!!');
			reject('Update this part of the tools.pbcs.ts file');
		});
	};
	public runProcedure = (refObj: DimeEnvironmentPBCS) => {
		return new Promise((resolve, reject) => {
			console.log('!!!!!!!!!!!!');
			console.log('Update this part of the tools.pbcs.ts file');
			console.log('!!!!!!!!!!!!');
			reject('Update this part of the tools.pbcs.ts file');
		});
	};
	public getDescriptions = (refObj: any) => {
		return new Promise((resolve, reject) => {
			if (!refObj) {
				reject('No proper information provided.');
			} else if (!refObj.field) {
				reject('No field information is provided');
			} else if (!refObj.field.generation2members) {
				reject('No generation 2 member names provided.');
			} else {
				let memberList: string[]; memberList = refObj.field.generation2members.split('|||');
				this.initiateRest(refObj).
					then((innerObj: DimeEnvironmentPBCS) => {
						return this.pbcsGetDescriptions(innerObj, memberList);
					}).
					then(resolve).
					catch(reject);
			}
		});
	};
	private pbcsGetDescriptions = (refObj: DimeEnvironmentPBCS, memberList: any) => {
		return new Promise((resolve, reject) => {
			/*
			const promises: any[] = [];
			memberList.forEach((curMember) => {
				promises.push(this.pbcsGetDescriptionsAction(refObj, curMember));
			});
			Promise.all(promises).
				then((result) => {
					console.log(result);
					reject('pbcsGetDescriptions is not ready yet');
				}).
				catch(reject);
			*/
			async.eachOfSeries(memberList, (item, key, callback) => {
				this.pbcsGetDescriptionsAction(refObj, item).
					then((result) => {
						console.log(item, 'finished');
						console.log(result);
						callback();
					}).
					catch(callback);
			}, (err: any) => {
				console.log('all finished', err);
				reject('We fetched');
			});
		});
	};
	private pbcsGetDescriptionsAction = (refObj: DimeEnvironmentPBCS, member: any) => {
		return new Promise((resolve, reject) => {
			this.initiateRest(refObj).
				then((innerObj: DimeEnvironmentPBCS) => {
					request.get({
						url: innerObj.resturl + '/applications/' + innerObj.database + '/dimensions/' + innerObj.field.name + '/members/' + member,
						auth: {
							user: innerObj.username,
							pass: innerObj.password,
							sendImmediately: true
						},
						headers: { 'Content-Type': 'application/json' }
					}, (err, response, body) => {
						if (err) {
							reject(err);
						} else {
							this.tools.parseJsonString(body).
								then((result: any) => {
									const allMembers: any[] = [];
									this.pbcsFormatDescriptionArray(result, allMembers);
									resolve(allMembers);
								}).
								catch(reject);
						}
					});
				}).
				catch(reject);
		});
	};
	private pbcsFormatDescriptionArray = (curMember: any, allMembers: any[]) => {
		let toPush: any; toPush = {};
		toPush.RefField = curMember.name;
		toPush.Description = curMember.description;
		if (!toPush.Description) { toPush.Description = toPush.RefField; }
		allMembers.push(toPush);
		if (curMember.children) {
			if (Array.isArray(curMember.children)) {
				curMember.children.forEach((curChild: any) => {
					this.pbcsFormatDescriptionArray(curChild, allMembers);
				});
			}
		}
	};
	public writeData = (refObj: any) => {
		return new Promise((resolve, reject) => {
			console.log('!!!!!!!!!!!!');
			console.log('Update writeData part of the tools.pbcs.ts file');
			console.log('!!!!!!!!!!!!');
			reject('Update this part of the tools.pbcs.ts file');
		});
	};
}
