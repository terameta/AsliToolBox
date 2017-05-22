import { ActivatedRoute, Router } from "@angular/router";
import { Injectable } from "@angular/core";
import { Http, Response, Headers } from "@angular/http";

import { BehaviorSubject, Observable } from "rxjs/Rx";
import { AuthHttp } from "angular2-jwt";
import { ToastrService } from "ngx-toastr";

import { DimeStreamService } from "../dimestream/dimestream.service";

import { DimeMap } from "../../../../../shared/model/dime/map";
import { DimeStream } from "../../../../../shared/model/dime/stream";

@Injectable()
export class DimeMapService {
	items: Observable<DimeMap[]>;
	itemCount: Observable<number>;
	curItem: DimeMap;
	curItemIsReady: boolean;
	curItemFields: any[];
	curItemClean: boolean;
	curItemSourceStream: DimeStream;
	curItemSourceStreamFields: any[];
	curItemTargetStream: DimeStream;
	curItemTargetStreamFields: any[];
	private serviceName: string;
	private _items: BehaviorSubject<DimeMap[]>;
	private baseUrl: string;
	private dataStore: {
		items: DimeMap[]
	};
	private headers = new Headers({ "Content-Type": "application/json" });

	constructor(
		private http: Http,
		private authHttp: AuthHttp,
		private toastr: ToastrService,
		private router: Router,
		private route: ActivatedRoute,
		private streamService: DimeStreamService
	) {
		this.baseUrl = "/api/dime/map";
		this.dataStore = { items: [] };
		this._items = <BehaviorSubject<DimeMap[]>>new BehaviorSubject([]);
		this.items = this._items.asObservable();
		this.itemCount = this.items.count();
		this.serviceName = "Maps";
		this.resetCurItem();
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
				console.log("Could not load maps.");
			});
	}
	getOne = (id: number) => {
		this.authHttp.get(this.baseUrl + "/" + id).
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
				if (this.curItem.source) { this.getStreamDefinition(this.curItem.source, "source"); }
				if (this.curItem.target) { this.getStreamDefinition(this.curItem.target, "target"); }
				this.isReady(this.curItem.id);
			}, (error) => {
				this.toastr.error("Failed to get the item.", this.serviceName);
				console.log(error);
			});
	}
	private getStreamDefinition = (id: number, srctar: string) => {
		this.streamService.fetchOne(id).subscribe((result) => {
			if (srctar === "source") { this.curItemSourceStream = result; }
			if (srctar === "target") { this.curItemTargetStream = result; }
		}, (error) => {
			this.toastr.error("Failed to fetch stream definition.", this.serviceName);
			console.log(error);
		});
		this.streamService.retrieveFieldsFetch(id).subscribe((result) => {
			if (srctar === "source") { this.curItemSourceStreamFields = result; }
			if (srctar === "target") { this.curItemTargetStreamFields = result; }
			if (!this.curItemFields) { this.getFields(); }
		}, (error) => {
			this.toastr.error("Failed to fetch stream fields list.", this.serviceName);
			console.log(error);
		})
	}
	create = () => {
		this.authHttp.post(this.baseUrl, {}, { headers: this.headers }).
			map(response => response.json()).
			subscribe((result) => {
				this.dataStore.items.push(result);
				this.dataStore.items.sort(this.sortByName);
				this._items.next(Object.assign({}, this.dataStore).items);
				this.resetCurItem();
				this.router.navigate(["/dime/maps/map-detail", result.id]);
				this.toastr.info("New item is created, navigating to the details", this.serviceName);
			}, (error) => {
				this.toastr.error("Failed to create new item.", this.serviceName);
				console.log(error);
			}
			);
	};
	update = (curItem?: DimeMap) => {
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
				this.toastr.info("Item is successfully saved.", this.serviceName);
				// If the update request came from another source, then it is an ad-hoc save of a non-current stream.
				// This shouldn't change the state of the current item.
				if (shouldUpdate) { this.curItemClean = true; }
			}, error => {
				this.toastr.error("Failed to save the item.", this.serviceName);
				console.log(error);
			});
	};
	delete(id: number) {
		const verificationQuestion = this.serviceName + ": Are you sure you want to delete " + (name !== undefined ? name : "the item") + "?";
		if (confirm(verificationQuestion)) {
			this.authHttp.delete(this.baseUrl + "/" + id).subscribe(response => {
				this.dataStore.items.forEach((item, index) => {
					if (item.id === id) { this.dataStore.items.splice(index, 1); }
				});
				this.dataStore.items.sort(this.sortByName);
				this._items.next(Object.assign({}, this.dataStore).items);
				this.toastr.info("Item is deleted.", this.serviceName);
				this.router.navigate(["/dime/maps/map-list"]);
				this.resetCurItem();
			}, (error) => {
				this.toastr.error("Failed to delete item.", this.serviceName);
				console.log(error);
			});
		} else {
			this.toastr.info("Item deletion is cancelled.", this.serviceName);
		}
	};
	private resetCurItem = () => {
		this.curItem = { id: 0, name: "-" };
		this.curItemFields = undefined;
		this.curItemClean = true;
		this.curItemIsReady = false;
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
	public assignSourceFields = () => {
		let fieldsToAssign: string[];
		fieldsToAssign = [];
		this.curItemSourceStreamFields.forEach((curField) => {
			if (curField.mappable) { fieldsToAssign.push(curField.name); }
		});
		this.setFields(fieldsToAssign, "source");
	};
	public assignTargetFields = () => {
		let fieldsToAssign: string[];
		fieldsToAssign = [];
		this.curItemTargetStreamFields.forEach((curField) => {
			if (curField.mappable) { fieldsToAssign.push(curField.name); }
		});
		this.setFields(fieldsToAssign, "target");
	};
	private setFields = (fields: string[], srctar: string) => {
		if (!fields) {
			this.toastr.error("No fields are selected.", this.serviceName);
		} else if (fields.length === 0) {
			this.toastr.error("No fields are selected.", this.serviceName);
		} else {
			const toSend = {
				map: this.curItem.id,
				type: srctar,
				list: fields
			};
			this.authHttp.post(this.baseUrl + "/fields/", toSend, { headers: this.headers }).
				map(response => response.json()).
				subscribe((result) => {
					this.toastr.info("Map field assignments completed.", this.serviceName);
				}, (error) => {
					this.toastr.error("Failed to assign fields.", this.serviceName);
					console.log(error);
				});
		}
	};
	private getFields = (id?: number) => {
		if (!id) { id = this.curItem.id; }
		this.authHttp.get(this.baseUrl + "/fields/" + id, { headers: this.headers }).
			map(response => response.json()).
			subscribe((result) => {
				this.curItemFields = result;
				this.matchFields();
			}, (error) => {
				this.toastr.error("Failed to get map fields.", this.serviceName);
				console.log(error);
			})
	};
	private matchFields = () => {
		if (this.curItemSourceStreamFields) {
			this.curItemSourceStreamFields.forEach((curField: { name: string, mappable: boolean }) => {
				curField.mappable = false;
				this.curItemFields.forEach((curMapField) => {
					if (curMapField.name === curField.name && curMapField.srctar === "source") {
						curField.mappable = true;
					}
				});
			});
		}
		if (this.curItemTargetStreamFields) {
			this.curItemTargetStreamFields.forEach((curField: { name: string, mappable: boolean }) => {
				curField.mappable = false;
				this.curItemFields.forEach((curMapField) => {
					if (curMapField.name === curField.name && curMapField.srctar === "target") {
						curField.mappable = true;
					}
				});
			});
		}
	};
	public prepareTables = (id?: number) => {
		if (!id) { id = this.curItem.id; }
		this.authHttp.get(this.baseUrl + "/prepare/" + id, { headers: this.headers }).
			map(response => response.json()).
			subscribe((result) => {
				this.toastr.info("Map tables are successfully created.", this.serviceName);
				console.log("PrepareTables:", result);
				this.isReady();
			}, (error) => {
				this.toastr.error("Failed to prepare the map tables.", this.serviceName);
				console.log(error);
			})
	}
	public isReady = (id?: number) => {
		if (!id) { id = this.curItem.id; }
		this.authHttp.get(this.baseUrl + "/isReady/" + id, { headers: this.headers }).
			map(response => response.json()).
			subscribe((result) => {
				if (result.result === "YES") { this.curItemIsReady = true; }
			}, (error) => {
				this.toastr.error("Failed to check the readiness of the map tables.", this.serviceName);
				console.log(error);
			})
	}
}
