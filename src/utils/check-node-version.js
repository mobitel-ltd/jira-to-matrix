const Ramda = require('ramda');
const semver = require('semver');
const {engines} = require('../../package.json');
const logger = require('simple-color-logger')();

function checkNodeVersion() {
    const version = Ramda.is(Object, engines) ? engines.node : undefined;
    if (!version) {
        logger.error('cannot find required Node version in package.json');
        return false;
    }
    if (!semver.satisfies(process.version, version)) {
        logger.error(`Required node version ${version} not satisfied with current version ${process.version}.`);
        return false;
    }
    return true;
}

module.exports = checkNodeVersion;
