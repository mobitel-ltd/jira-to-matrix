const R = require('ramda');
const fetch = require('node-fetch');
const logger = require('simple-color-logger')();
const to = require('await-to-js').default;

/**
 * @param {String} url URL to JIRA API
 * @param {String} basicAuth Authorization parameters for API
 * @returns {Promise} ???
 */
async function fetchJSON(url, basicAuth) {
    const options = {
        headers: {Authorization: basicAuth},
        timeout: 5000,
    };
    const [err, response] = await to(fetch(url, options));
    if (err) {
        logger.error(`Error while getting ${url}:\n${err}`);
        return undefined;
    }
    logger.info(response._convert().toString());
    try {
        logger.info(JSON.parse(response._convert().toString()));
    } catch (err) {
        logger.error(err.message);
    }
    const [parseErr, object] = await to(response.json());
    if (parseErr) {
        logger.error(`Error while parsing JSON from ${url}:\n${parseErr}`);
        return undefined;
    }
    return object;
}

function paramsToQueryString(params/* :Array<{}>*/) {
    const toStrings = R.map(R.pipe(
        R.mapObjIndexed((value, key) => `${key}=${value}`),
        R.values
    ));
    return R.ifElse(
        R.isEmpty,
        R.always(''),
        R.pipe(toStrings, R.join('&'), R.concat('?'))
    )(params || []);
}

module.exports = {
    fetchJSON,
    paramsToQueryString,
};
