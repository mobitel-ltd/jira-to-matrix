const conf = require('../config');
// const logger = require('debug')('index matrix');
const {connect, disconnect} = require('./sdk-client')(conf.matrix);

// logger('Matrix.connect', connect);
module.exports.connect = require('./api-client')(connect);
module.exports.helpers = require('./helpers'); // eslint-disable-line import/newline-after-import
module.exports.disconnect = disconnect;
