const Ramda = require('ramda');
const semver = require('semver');
const {engines} = require('../../package.json');
const logger = require('debug')('check-node-version');

module.exports = () => {
    const version = Ramda.is(Object, engines) ? engines.node : null;
    if (!version) {
        logger('cannot find required Node version in package.json');
        return false;
    }
    if (!semver.satisfies(process.version, version)) {
        logger(`Required node version ${version} not satisfied with current version ${process.version}.`);
        return false;
    }
    return true;
};
