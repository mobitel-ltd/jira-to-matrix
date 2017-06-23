const matrix = require('../matrix')

async function middleware(req, res, next) {
    const client = await matrix.connect()
    if (!client) {
        next(new Error('Could not connect to Matrix'))
        return
    }
    req.mclient = client
    next()
}

module.exports = middleware
