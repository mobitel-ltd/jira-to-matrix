const matrix = require('../matrix')
const logger = require('simple-color-logger')()

async function middleware(req, res, next) {
    let client = await matrix.connect()
    let boolErr = false
    let count = 0

    while (!client) {
        client = matrix.connect()
        boolErr = true

        if (count >= 10) {
            next(new Error('Could not connect to Matrix'))
        }
        count += 1
    }

    if (boolErr) {
        logger.error('Could not connect to Matrix')
    }

    req.mclient = client
    next()
}

module.exports = middleware
