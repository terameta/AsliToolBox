import { Application } from "express";
import * as mysql from "mysql";
import * as bcrypt from "bcrypt";

import { MainTools } from "../config/config.tools";

export function apiAuth(app: Application, refDB: mysql.IPool, refTools: MainTools) {
	app.route("/api/auth/signin").post((req, res) => {

		if (!req.body) {
			res.status(500).json({ status: "fail", message: "No credentials presented" });
		} else if (!req.body.username || !req.body.password) {
			res.status(500).json({ status: "fail", message: "No credentials presented" });
		} else {
			const fixedUserName = mysql.escape(req.body.username.toString().toLowerCase());
			refDB.query("SELECT * FROM users WHERE username = " + fixedUserName, function (err, results, fields) {
				if (err) {
					res.status(500).json({ status: "fail", message: "Database error. Please consult with system admin" });
				} else if (results.length !== 1) {
					res.status(500).json({ status: "fail", message: "Multiple users are defined with same username. Please consult with system admin." });
				} else {
					console.log(results);
					const dbPass = results[0].password;
					bcrypt.compare(req.body.password, dbPass, function (encerr, hashResult) {
						if (encerr) {
							res.status(500).json({ status: "fail", message: "There is an issue with the encryption. Please consult with system admin." });
						} else if (!hashResult) {
							res.status(400).json({ status: "fail", message: "Authentication Failed" });
						} else {
							delete results[0].password;
							const payload = results[0];
							const token = refTools.signToken(payload);
							res.json({
								status: "success",
								message: "Welcome to EPM Tool Box",
								token: token
							});
						}
					});
				}
			});
		}
	});
}
