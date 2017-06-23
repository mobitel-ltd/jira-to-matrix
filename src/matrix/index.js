const conf = require('../config')
const logger = require('simple-color-logger')()
const { connect, disconnect } = require('./sdk-client')(conf.matrix, logger)

module.exports.connect = require('./api-client')(connect)
module.exports.helpers = require('./helpers') // eslint-disable-line import/newline-after-import
module.exports.disconnect = disconnect
