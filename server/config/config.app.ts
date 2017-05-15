import * as express from "express";
import * as http from "http";
import * as path from "path";
import * as bodyParser from "body-parser";
import * as helmet from "helmet";
import * as logger from "morgan";
import * as jwt from "express-jwt";

import { IPool } from "mysql";

import { SystemConfig } from "../../shared/model/systemconfig";

import { Application } from "express";
import { initializeRestApi } from "../api/api";
import { MainTools } from "./config.tools";

export function initiateApplicationWorker(refDB: IPool, refConfig: SystemConfig) {
	const app: Application = express();
	const mainTools = new MainTools(refConfig);

	app.use(bodyParser.json({ limit: "100mb" }));
	app.use(bodyParser.text({ limit: "100mb" }));
	app.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));
	app.use(express.static(path.join(__dirname, "../../client/dist")));

	app.enable("trust proxy");

	app.use(helmet());
	app.use(helmet.noCache());

	app.use(logger("short"));

	app.use("/api", jwt({ secret: refConfig.hash }).unless({ path: ["/api/auth/signin"] }));
	// app.use(jwt({ secret: refConfig.hash }).unless({ path: ["/api/auth/signin", "/welcome/signin", "/", "/welcome"] }));

	initializeRestApi(app, refDB, mainTools);

	app.set("port", 8000);

	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
	});

	const server: http.Server = app.listen(app.get("port"), () => {
		console.log("Server is now running on port " + server.address().port);
	});

}