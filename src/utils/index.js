/* eslint-disable import/newline-after-import */
const rest = require('./rest.js');
const checkNodeVersion = require('./check-node-version.js');
const fp = require('./fp.js');

module.exports = {
    ...rest,
    checkNodeVersion,
    fp,
};
