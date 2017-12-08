const {matrix} = require('../config');
const init = require('./sdk-client');
const apiClient = require('./api-client');
const helpers = require('./helpers');

const connect = async () => {
    const {connect} = await init(matrix);
    const result = apiClient(connect)();
    return result;
};

const disconnect = async () => {
    const {disconnect} = await init(matrix);
    return disconnect;
};

module.exports = {helpers, connect, disconnect};
