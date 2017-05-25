import { ActivatedRoute, Router } from '@angular/router';
import { Headers, Http, Response } from '@angular/http';
import { Injectable } from '@angular/core';

import { ToastrService } from 'ngx-toastr/toastr/toastr-service';
import { BehaviorSubject } from 'rxjs/Rx';
import 'rxjs/Rx';
import { Observable } from 'rxjs/Observable';
import { AuthHttp } from 'angular2-jwt';

import { DimeProcess } from '../../../../../shared/model/dime/process';
import { DimeProcessStep } from '../../../../../shared/model/dime/processstep';
import { DimeProcessStepType } from '../../../../../shared/model/dime/processsteptype';
import { DimeStream } from '../../../../../shared/model/dime/stream';

import { DimeEnvironmentService } from '../dimeenvironment/dimeenvironment.service';
import { DimeStreamService } from '../dimestream/dimestream.service';

@Injectable()
export class DimeProcessService {
	items: Observable<DimeProcess[]>;
	curItem: DimeProcess;
	curItemIsReady: boolean;
	curItemSteps: DimeProcessStep[];
	curItemClean: boolean;
	curItemSourceStream: DimeStream;
	curItemTargetStream: DimeStream;
	curItemSourceFields: any[];
	curItemTargetFields: any[];
	curItemTargetProcedures: any[];
	curItemSelectedProcedure: any;
	curStep: DimeProcessStep;
	curStepManipulations: any[];
	stepTypes: DimeProcessStepType[];
	private serviceName: string;
	private _items: BehaviorSubject<DimeProcess[]>;
	private baseUrl: string;
	private dataStore: {
		items: DimeProcess[]
	};
	private headers = new Headers({ 'Content-Type': 'application/json' });

	constructor(
		private http: Http,
		private authHttp: AuthHttp,
		private toastr: ToastrService,
		private router: Router,
		private route: ActivatedRoute,
		private environmentService: DimeEnvironmentService,
		private streamService: DimeStreamService
	) {
		this.baseUrl = '/api/dime/process';
		this.dataStore = { items: [] };
		this._items = <BehaviorSubject<DimeProcess[]>>new BehaviorSubject([]);
		this.items = this._items.asObservable();
		this.serviceName = 'Processes';
		this.resetCurItem();
		this.stepFetchTypes();
	}

	getAll = () => {
		this.authHttp.get(this.baseUrl).
			map((response) => {
				return response.json();
			}).
			subscribe((data) => {
				data.sort(this.sortByName);
				this.dataStore.items = data;
				this._items.next(Object.assign({}, this.dataStore).items);
			}, (error) => {
				this.toastr.error('Failed to load items.', this.serviceName);
				console.log(error);
			});
	}
	getOne = (id: number) => {
		this.authHttp.get(this.baseUrl + '/' + id).
			map(response => response.json()).
			subscribe((result) => {
				let notFound = true;

				this.dataStore.items.forEach((item, index) => {
					if (item.id === result.id) {
						this.dataStore.items[index] = result;
						notFound = false;
					}
				});

				if (notFound) {
					this.dataStore.items.push(result);
				}

				this.dataStore.items.sort(this.sortByName);
				this._items.next(Object.assign({}, this.dataStore).items);
				this.curItem = result;
				this.curItemClean = true;
				this.isReady(this.curItem.id);
				this.stepGetAll(this.curItem.id);
			}, (error) => {
				this.toastr.error('Failed to get the item.', this.serviceName);
				console.log(error);
			});
	}
	create = () => {
		this.authHttp.post(this.baseUrl, {}, { headers: this.headers }).
			map(response => response.json()).
			subscribe((result) => {
				this.dataStore.items.push(result);
				this.dataStore.items.sort(this.sortByName);
				this._items.next(Object.assign({}, this.dataStore).items);
				this.resetCurItem();
				this.router.navigate(['/dime/processes/process-detail', result.id]);
				this.toastr.info('New item is created, navigating to the details', this.serviceName);
			}, (error) => {
				this.toastr.error('Failed to create new item.', this.serviceName);
				console.log(error);
			}
			);
	};
	update = (curItem?: DimeProcess) => {
		let shouldUpdate = false;
		if (!curItem) { curItem = this.curItem; shouldUpdate = true; };
		this.authHttp.put(this.baseUrl, curItem, { headers: this.headers }).
			map(response => response.json()).
			subscribe((result) => {
				this.dataStore.items.forEach((item, index) => {
					if (item.id === result.id) { this.dataStore.items[index] = result; }
				});
				this.dataStore.items.sort(this.sortByName);
				this._items.next(Object.assign({}, this.dataStore).items);
				this.toastr.info('Item is successfully saved.', this.serviceName);
				// If the update request came from another source, then it is an ad-hoc save of a non-current stream.
				// This shouldn't change the state of the current item.
				if (shouldUpdate) { this.curItemClean = true; }
				this.stepGetAll(this.curItem.id);
			}, error => {
				this.toastr.error('Failed to save the item.', this.serviceName);
				console.log(error);
			});
	};
	delete(id: number, name?: string) {
		const verificationQuestion = this.serviceName + ': Are you sure you want to delete ' + (name !== undefined ? name : 'the item') + '?';
		if (confirm(verificationQuestion)) {
			this.authHttp.delete(this.baseUrl + '/' + id).subscribe(response => {
				this.dataStore.items.forEach((item, index) => {
					if (item.id === id) { this.dataStore.items.splice(index, 1); }
				});
				this.dataStore.items.sort(this.sortByName);
				this._items.next(Object.assign({}, this.dataStore).items);
				this.toastr.info('Item is deleted.', this.serviceName);
				this.router.navigate(['/dime/processes/process-list']);
				this.resetCurItem();
			}, (error) => {
				this.toastr.error('Failed to delete item.', this.serviceName);
				console.log(error);
			});
		} else {
			this.toastr.info('Item deletion is cancelled.', this.serviceName);
		}
	};
	private resetCurItem = () => {
		this.curItem = { id: 0, name: '-' };
		this.curItemSteps = undefined;
		this.curItemClean = true;
		this.curItemIsReady = false;
		this.curItemSourceStream = { id: 0, name: '-', type: 0, environment: 0 };
		this.curItemTargetStream = { id: 0, name: '-', type: 0, environment: 0 };
		this.curItemSourceFields = [];
		this.curItemTargetFields = [];
		this.curItemTargetProcedures = [];
		this.curItemSelectedProcedure = {};
	};
	private sortByName = (e1, e2) => {
		if (e1.name > e2.name) {
			return 1;
		} else if (e1.name < e2.name) {
			return -1;
		} else {
			return 0;
		}
	};
	public isReady = (id?: number) => {
		if (!id) { id = this.curItem.id; }
		this.toastr.warning('is Ready function should be implemented', this.serviceName);
		this.curItemIsReady = false;
	}
	private stepFetchTypes = () => {
		this.authHttp.get(this.baseUrl + '/steptypes').
			map(response => response.json()).
			subscribe((result) => {
				this.stepTypes = result;
			}, (error) => {
				this.toastr.error('Failed to receive process step types.', this.serviceName);
				console.error(error);
			})
	}
	public stepCreate = () => {
		this.authHttp.post(this.baseUrl + '/step', { process: this.curItem.id }, { headers: this.headers }).
			map(response => response.json()).
			subscribe((result) => {
				this.stepGetAll(this.curItem.id);
			}, (error) => {
				this.toastr.error('Failed to add step.', this.serviceName);
				console.error(error);
			});
	}
	public stepGetAll = (id?: number) => {
		if (!id) { id = this.curItem.id; }
		this.authHttp.get(this.baseUrl + '/steps/' + id).
			map(response => response.json()).
			subscribe((result) => {
				this.curItemSteps = result;
				this.curItemSteps.forEach((curStep) => {
					if (curStep.type === 'srcprocedure' && this.curItem.source) { curStep.referedid = this.curItem.source; }
					if (curStep.type === 'tarprocedure' && this.curItem.target) { curStep.referedid = this.curItem.target; }
					if (curStep.type === 'pulldata') {
						this.streamService.fetchOne(curStep.referedid).subscribe((data) => {
							this.curItemSourceStream = data;
						}, (error) => {
							this.toastr.error('Failed to receive the source stream details.', this.serviceName);
							console.log(error);
						});
						this.streamService.retrieveFieldsFetch(curStep.referedid).subscribe((data) => {
							this.curItemSourceFields = data;
						}, (error) => {
							this.toastr.error('Failed to receive the source stream fields.', this.serviceName);
							console.log(error);
						});
					}
					if (curStep.type === 'pushdata') {
						this.streamService.fetchOne(curStep.referedid).subscribe((data) => {
							this.curItemTargetStream = data;
						}, (error) => {
							this.toastr.error('Failed to receive the target stream details.', this.serviceName);
							console.log(error);
						});
						this.streamService.retrieveFieldsFetch(curStep.referedid).subscribe((data) => {
							this.curItemTargetFields = data;
						}, (error) => {
							this.toastr.error('Failed to receive the target stream fields.', this.serviceName);
							console.log(error);
						});
					}
				});
			}, (error) => {
				this.toastr.error('Failed to get the steps.', this.serviceName);
				console.log(error);
			});
	};
	public stepGetOne = (id: number) => {
		this.authHttp.get(this.baseUrl + '/step/' + id).
			map(response => response.json()).
			subscribe((result) => {
				this.curStep = result;
				this.stepPrepare();
				if (this.curItem.id < 1) { this.getOne(this.curStep.process); }
			}, (error) => {
				this.toastr.error('Failed to get the current step.', this.serviceName);
				console.error(error);
			});
	};
	public stepPrepare = () => {
		this.curStepManipulations = [];
		if (this.curStep.type === 'manipulate' && this.curStep.details) {
			this.curStepManipulations = JSON.parse(this.curStep.details);
		}
		if (this.curStep.type === 'tarprocedure') {
			this.stepListProcedures();
		}
	}
	public stepDelete = (id: number) => {
		this.authHttp.delete(this.baseUrl + '/step/' + id).
			map(response => response.json()).
			subscribe((result) => {
				this.stepGetAll(this.curItem.id);
			}, (error) => {
				this.toastr.error('Failed to delete step.', this.serviceName);
				console.error(error);
			});
	};
	public stepUpdate = (curStep?: DimeProcessStep) => {
		let shouldUpdate = false;
		if (!curStep) { curStep = this.curStep; shouldUpdate = true; }
		if (shouldUpdate && curStep.type === 'srcprocedure') { curStep.referedid = this.curItem.source; }
		if (shouldUpdate && curStep.type === 'tarprocedure') { curStep.referedid = this.curItem.target; }
		if (curStep.type === 'manipulate') {
			curStep.details = JSON.stringify(this.curStepManipulations);
			if (shouldUpdate) {
				this.curStep.details = curStep.details;
			}
		}
		this.authHttp.put(this.baseUrl + '/step', curStep, { headers: this.headers }).
			map(response => response.json()).
			subscribe((result) => {
				this.toastr.info('Step is successfully saved.', this.serviceName);
				if (shouldUpdate) { this.curStep = result; }
				this.stepGetAll(this.curItem.id);
			}, (error) => {
				this.toastr.error('Step save has failed.', this.serviceName);
				console.error(error);
			});
	};
	public stepManipulationAdd = () => {
		this.curStepManipulations.push({ mOrder: this.curStepManipulations.length });
		this.stepManipulationSort();
	};
	public stepManipulationMove = (curManipulation: any, direction: string) => {
		const curOrder = curManipulation.mOrder;
		const nextOrder = parseInt(curOrder, 10) + (direction === 'down' ? 1 : -1);
		this.curStepManipulations.forEach(function (curField) {
			if (curField.mOrder === nextOrder) {
				curField.mOrder = curOrder;
			}
		});
		curManipulation.mOrder = nextOrder;
		this.stepManipulationSort();
	};
	public stepManipulationDelete = (curManipulation: any, index: number) => {
		if (index !== undefined) {
			this.curStepManipulations.splice(index, 1);
		}
		this.stepManipulationSort();
	};
	public stepManipulationSort = () => {
		this.curStepManipulations.sort((e1, e2) => {
			if (e1.mOrder > e2.mOrder) {
				return 1;
			} else if (e1.mOrder < e2.mOrder) {
				return -1;
			} else {
				return 0;
			}
		});
		this.curStepManipulations.forEach((curManip, curKey) => {
			curManip.mOrder = curKey;
		})
	};
	public stepListProcedures = (numTry?: number) => {
		if (numTry === undefined) { numTry = 0; }
		if (this.curItem.target && this.curItemTargetStream.id && numTry < 100) {
			this.environmentService.listProcedures(this.curItem.target, this.curItemTargetStream).
				subscribe((data) => {
					console.log(data);
					this.curItemTargetProcedures = data;
					this.toastr.info('Received procedure list');
				}, (error) => {
					this.toastr.error('Failed to list procedures.', this.serviceName);
					console.error(error);
				});
		} else {
			setTimeout(() => {
				// console.log('Environment: ' + this.curItem.source + ', Target Stream: ' + this.curItemTargetStream.id + ' we will retry.', numTry);
				this.stepListProcedures(++numTry);
			}, 1000);
		}
	}
}
