const matrix = require('../matrix');
const logger = require('simple-color-logger')();

async function middleware(req, res, next) {
    let client;
    let count = 0;
    let err;

    while (!client) {
        client = await matrix.connect();

        if (count >= 10) {
            err = new Error('Could not connect to Matrix');
            break;
        }
        count += 1;
        logger.info(`the connection with the Matrix: ${count}\n Web-hook: ${req.body.webhookEvent}`);
    }

    if (err) {
        next(err);
    } else {
        req.mclient = client;
        next();
    }
}

module.exports = middleware;
