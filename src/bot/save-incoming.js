const to = require('await-to-js').default
const redis = require('../redis-client')
const conf = require('../config')
const logger = require('simple-color-logger')()

async function save(req, res, next) {
    if (!req.jiraKey) {
        return
    }
    const [err] = await to(
    redis.setAsync(req.jiraKey, req.formattedJSON, 'EX', conf.redis.ttl)
  )
    if (err) {
        logger.error(`Error while saving to redis:\n${err.message}`)
    }
    next()
}

module.exports = save
