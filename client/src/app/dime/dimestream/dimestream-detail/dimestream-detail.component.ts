import { ActivatedRoute, Router, Params } from "@angular/router";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { NgForm } from "@angular/forms";

import { ToastrService } from "ngx-toastr";
import { Subscription } from "rxjs/Subscription";

import { DimeStreamService } from "../dimestream.service";
import { DimeEnvironmentService } from "../../dimeenvironment/dimeenvironment.service";

@Component({
	selector: "app-dimestream-detail",
	templateUrl: "./dimestream-detail.component.html",
	styleUrls: ["./dimestream-detail.component.css"]
})
export class DimestreamDetailComponent implements OnInit, OnDestroy {
	paramsSubscription: Subscription;
	// curStreamClean = true;
	// databaseList = [];
	// tableList = [];
	// curStreamID: number;
	// curStream: any = {};
	// streamTypeList = [];
	// environmentList = [];

	// environmentTypeList = [];
	// curStreamEnvironmentType;
	// sourcedFields: any[] = undefined;
	// assignedFields: any[] = undefined;
	// descriptiveTables: any = {};
	// descriptiveFields: any = {};
	// pbcsFieldTypes = [
	// 	"Accounts",
	// 	"Entity",
	// 	"Generic",
	// 	"Scenario",
	// 	"Time",
	// 	"Year",
	// 	"Version"
	// ];

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private mainService: DimeStreamService,
		private environmentService: DimeEnvironmentService,
	) { }

	ngOnInit() {
		this.paramsSubscription = this.route.params.subscribe(
			(params: Params) => {
				this.mainService.getOne(params["id"]);
			}
		);
	}

	ngOnDestroy() {
		// this.paramsSubscription.unsubscribe();
	}

	private sortByName = (e1, e2) => {
		if (e1.name > e2.name) {
			return 1;
		} else if (e1.name < e2.name) {
			return -1;
		} else {
			return 0;
		}
	}
/*

	streamSave(form: NgForm) {
		this.streamService.update(this.curStream).subscribe(
			(result) => {
				this.toastr.info("Information updated");
				this.streamGetCurrent();
			}, (error) => {
				this.toastr.error(error);
			}
		);
	}

	streamRefreshDatabases() {
		if (!this.curStreamClean) {
			this.toastr.error("Please save the stream before refreshing database list");
			return false;
		}
		this.environmentService.listDatabases(this.curStream.environment).subscribe(
			(result) => {
				this.toastr.info("Database list is updated");
				this.databaseList = result;
			}, (error) => {
				this.toastr.error(error);
			}
		);
	}

	streamRefreshTables() {
		if (!this.curStreamClean) {
			this.toastr.error("Please save the stream before refreshing the table list");
			return false;
		}
		this.environmentService.listTables(this.curStream.environment, this.curStream.dbName).subscribe(
			(result) => {
				this.toastr.info("Table list is updated");
				this.tableList = result;
			}, (error) => {
				this.toastr.error(error);
			}
		);
	}

	streamDelete(streamID) {
		this.streamService.delete(streamID).subscribe(
			(result) => {
				this.toastr.info("Stream is now deleted. We are now going back to the stream list.");
				this.router.navigate(["/dime/streams/stream-list"]);
			}, (error) => {
				this.toastr.error(error);
			}
		);
	}
	streamGetFields = (streamID: number) => {
		this.streamService.listFields(streamID).subscribe(
			(result) => {
				this.toastr.info("Stream fields are refreshed from the server");
				this.sourcedFields = result;
				this.sourcedFields.sort(this.streamFieldSortNumeric);
			}, (error) => {
				this.toastr.error(error);
				console.error(error);
			}
		);
	};
	streamFieldMove = (theFieldList: any[], theField, direction) => {
		const curOrder = theField.order || theField.fOrder || theField.pOrder;
		const nextOrder = parseInt(curOrder, 10) + (direction === "down" ? 1 : -1);
		theFieldList.forEach((curField) => {
			if (parseInt(curField.order, 10) === nextOrder) { curField.order = curOrder; }
			if (parseInt(curField.fOrder, 10) === nextOrder) { curField.fOrder = curOrder; }
			if (parseInt(curField.pOrder, 10) === nextOrder) { curField.pOrder = curOrder; }
		});
		if (theField.order) { theField.order = nextOrder; }
		if (theField.fOrder) { theField.fOrder = nextOrder; }
		if (theField.pOrder) { theField.pOrder = nextOrder; }
		theFieldList.sort(this.streamFieldSortNumeric);
	}
	streamFieldSortNumeric = (f1, f2): number => {
		let fItem: string;
		if (f1.order) { fItem = "order" };
		if (f1.fOrder) { fItem = "fOrder" };
		if (f1.pOrder) { fItem = "pOrder" };
		if (parseInt(f1[fItem], 10) > parseInt(f2[fItem], 10)) {
			return 1;
		} else if (parseInt(f1[fItem], 10) < parseInt(f2[fItem], 10)) {
			return -1;
		} else {
			return 0;
		}
	}
	streamAssignFields = () => {
		this.streamService.assignFields({ id: this.curStream.id, fields: this.sourcedFields }).subscribe(
			(result) => {
				this.toastr.info("Stream fields are assigned.");
				this.toastr.info("Refreshing the saved fields");
				this.streamRetrieveFields();
				this.sourcedFields = undefined;
			}, (error) => {
				this.toastr.error(error);
				console.error(error);
			}
		);
	}
	streamRetrieveFields = () => {
		this.streamService.retrieveFields(this.curStream.id).subscribe(
			(result) => {
				this.toastr.info("Stream fields are retrieved.");
				if (result.length > 0) {
					this.assignedFields = result;
					this.assignedFields.forEach((curField) => {
						if (curField.isDescribed && curField.descriptiveDB && curField.descriptiveTable) {
							if (!this.descriptiveTables[curField.descriptiveDB]) {
								this.descriptiveTables[curField.descriptiveDB] = [];
							}
							this.descriptiveTables[curField.descriptiveDB].push({ name: curField.descriptiveTable, type: "-" }, { name: "Custom Query", type: "-" });
							if (!this.descriptiveFields[curField.descriptiveDB]) {
								this.descriptiveFields[curField.descriptiveDB] = {};
							}
							if (!this.descriptiveFields[curField.descriptiveDB][curField.descriptiveTable]) {
								this.descriptiveFields[curField.descriptiveDB][curField.descriptiveTable] = [];
								if (curField.drfName) { this.descriptiveFields[curField.descriptiveDB][curField.descriptiveTable].push({ name: curField.drfName, type: curField.drfType }) };
								if (curField.ddfName) { this.descriptiveFields[curField.descriptiveDB][curField.descriptiveTable].push({ name: curField.ddfName, type: curField.ddfType }) };
							}
						}
					})
				}
			}, (error) => {
				this.toastr.error(error);
				console.error(error);
			}
		);
	}
	streamFieldsStartOver = () => {
		if (confirm("Are you sure to delete all the assigned fields?")) {
			this.streamService.clearFields(this.curStream.id).subscribe(
				(result) => {
					this.toastr.info("Stream fields are cleared.");
					this.assignedFields = undefined;
					this.sourcedFields = undefined;
				}, (error) => {
					this.toastr.error(error);
					console.error(error);
				}
			);
		}
	}
	streamFieldsSaveChanges = () => {
		this.streamService.saveFields({ id: this.curStream.id, fields: this.assignedFields }).subscribe(
			(result) => {
				this.toastr.info("Stream fields are saved.");
				this.toastr.info("Refreshing field list");
				this.streamRetrieveFields();
			}, (error) => {
				this.toastr.error(error);
				console.error(error);
			}
		);
	}
	streamInitiateFieldsPBCS = () => {
		this.sourcedFields = [
			{ "name": "Account", "type": "Accounts", "order": 1 },
			{ "name": "Period", "type": "Time", "order": 2 },
			{ "name": "Year", "type": "Year", "order": 3 },
			{ "name": "Scenario", "type": "Scenario", "order": 4 },
			{ "name": "Version", "type": "Version", "order": 5 },
			{ "name": "Entity", "type": "Entity", "order": 6 }
		];
	}
	streamSourcedFieldRemove = (curIndex) => {
		this.sourcedFields.splice(curIndex, 1);
		this.sourcedFields.forEach((curField, curKey) => {
			curField.order = curKey + 1;
		});
	}
	streamSourcedFieldAdd = () => {
		this.sourcedFields.push({ name: "", type: "", order: this.sourcedFields.length + 1 });
	}
	streamFieldRefreshTables = (field: any) => {
		if (!field.descriptiveDB) {
			this.toastr.error("Please assign a database to the field description before refreshing the table list");
			return false;
		}
		this.environmentService.listTables(this.curStream.environment, field.descriptiveDB).subscribe(
			(result) => {
				this.toastr.info("Table list is updated");
				this.descriptiveTables[field.descriptiveDB] = result;
			}, (error) => {
				this.toastr.error(error);
			}
		);
	}
	streamFieldGetFields = (field: any) => {
		this.streamService.listFieldsforField(this.curStream.environment, field).subscribe(
			(result) => {
				this.toastr.info("Descriptive fields are refreshed from the server for " + field.name);
				if (!this.descriptiveFields[field.descriptiveDB]) {
					this.descriptiveFields[field.descriptiveDB] = {};
				}
				this.descriptiveFields[field.descriptiveDB][field.descriptiveTable] = result;
				// this.sourcedFields = result;
				// this.sourcedFields.sort(this.streamFieldSortNumeric);
			}, (error) => {
				this.toastr.error(error);
				console.error(error);
			}
		);
	};
	setdrfType(field, event) {
		field.drfType = this.descriptiveFields[field.descriptiveDB][field.descriptiveTable][event.target.selectedIndex].type;
	}
	setddfType(field, event) {
		field.ddfType = this.descriptiveFields[field.descriptiveDB][field.descriptiveTable][event.target.selectedIndex].type;
	}
	*/
}
