// @flow
const redis = require('redis')
const bluebird = require('bluebird')
const conf = require('./config')
const logger = require('simple-color-logger')()

bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

function createClient(config) {
    let result
    try {
        result = redis.createClient(config)
    } catch (error) {
        logger.error(`Error while creating redis client ${error}`)
        process.exit(1)
    }
    return result
}
const client = createClient(conf.redis)

client.on('error', (err) => {
    logger.error(`Redis error:\n${err}`)
    if (/\bECONNREFUSED\b/.test(err.message || '')) {
        process.exit(1)
    }
})

module.exports = client
