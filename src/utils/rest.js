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
        timeout: 11000,
    };
    const [err, response] = await to(fetch(url, options));
    if (err) {
        logger.error(`Error while getting ${url}:\n${err}`);
        return;
    }

    logger.info(`response from jira have status: ${response.status}`,
        `    \nUrl: ${url}; Options: ${options.headers.Authorization}`)

    const [parseErr, object] = await to(response.json())
    if (parseErr) {
        logger.error(`Error while parsing JSON from ${url}:\n${parseErr}`);
        return;
    }
    return object;
}

async function fetchPostJSON(url, basicAuth, body) {
    const options = {
        method: 'POST',
        body: body,
        headers: {Authorization: basicAuth, "content-type": 'application/json'},
        timeout: 11000,
    };
    const [err, response] = await to(fetch(url, options));
    if (err) {
        logger.error(`Error while getting ${url}:\n${err}`);
        return;
    }

    logger.info(`response from jira have status: ${response.status}`,
        `\nUrl: ${url}; Options: ${options.headers.Authorization}`)

    return response;
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
    fetchPostJSON,
    paramsToQueryString,
};
