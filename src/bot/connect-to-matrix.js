const matrix = require('../matrix');
const logger = require('simple-color-logger')();

async function middleware(req, res, next) {
    let client;
    let count = 0;

    while (!client) {
        client = await matrix.connect();

        if (count >= 10) {
            next(new Error('Could not connect to Matrix'));
        }
        count += 1;
        logger.info(`the connection with the Matrix: ${count}\n Web-hook: ${req.body.webhookEvent}`);
    }

    req.mclient = client;
    next();
}

module.exports = middleware;
