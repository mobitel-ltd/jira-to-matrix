const matrix = require('../matrix');
const logger = require('debug')('connect to matrix bot');

module.exports = async (req, res, next) => {
    let client;
    let count = 0;
    let err;

    while (!client) {
        client = await matrix.connect();

        if (count >= 10) {
            count = 0;
            err = new Error('Could not connect to Matrix');
            break;
        }
        count += 1;
        logger(`the connection with the Matrix: ${count}\n Web-hook: ${req.body.webhookEvent}`);
    }

    if (err) {
        next(err);
    } else {
        req.mclient = client;
        next();
    }
};
