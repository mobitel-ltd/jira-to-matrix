/* eslint-disable import/newline-after-import */
const rest = require('./rest');

module.exports.fetchJSON = rest.fetchJSON;
module.exports.fetchPostJSON = rest.fetchPostJSON;
module.exports.fetchPutJSON = rest.fetchPutJSON;
module.exports.paramsToQueryString = rest.paramsToQueryString;
module.exports.checkNodeVersion = require('./check-node-version');
module.exports.fp = require('./fp');
