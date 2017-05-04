"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jwt = require("jsonwebtoken");
class MainTools {
    constructor(refConfig) {
        this.config = refConfig;
    }
    generateLongString(sentLength) {
        const length = sentLength || 128;
        const charset = "abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789()$^!_%|";
        const n = charset.length;
        let retVal = "";
        for (let i = 0; i < length; i++) {
            retVal += charset.charAt(Math.floor(Math.random() * n));
        }
        return retVal;
    }
    signToken(toSign) {
        return jwt.sign(toSign, this.config.hash, { expiresIn: 60 * 60 * 24 * 30 });
    }
    checkToken(req, res, next) {
        const token = req.body.token || req.query.token || req.headers["x-access-token"];
        if (token) {
            jwt.verify(token, this.config.hash, function (err, decoded) {
                if (err) {
                    return res.status(401).json({ status: "fail", message: "Failed to authenticate token" });
                }
                else {
                    req.curUser = decoded;
                    next();
                }
            });
        }
    }
}
exports.MainTools = MainTools;
//# sourceMappingURL=config.tools.js.map