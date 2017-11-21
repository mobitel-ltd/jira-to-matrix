const {matrix} = require('../config');
// const logger = require('debug')('index matrix');
const init = require('./sdk-client');
const apiClient = require('./api-client');
const helpers = require('./helpers');

// logger('Matrix.connect', connect);
const connect = async () => {
    const {connect} = await init(matrix);
    const result = apiClient(connect)();
    // logger('index connect', result);
    return result;
};

const disconnect = async () => {
    const {disconnect} = await init(matrix);
    return disconnect;
};

module.exports = {helpers, connect, disconnect};
