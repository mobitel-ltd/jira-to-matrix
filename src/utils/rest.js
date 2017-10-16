const Ramda = require('ramda');
const fetch = require('node-fetch');
const logger = require('simple-color-logger')();
const to = require('await-to-js').default;

/**
 * @param {String} url URL to JIRA API
 * @param {String} basicAuth Authorization parameters for API
 * @returns {Promise} ???
 */
const fetchJSON = async function(url, basicAuth) {
    const options = {
        headers: {Authorization: basicAuth},
        timeout: 11000,
    };
    const [err, response] = await to(fetch(url, options));
    if (err) {
        logger.error(`Error while getting ${url}:\n${err}`);
        return;
    }

    if (response.status >= 400) {
        throw new Error(`Jira response have status ${response.status}\nurl:${url}`);
    }

    logger.info(`response from jira have status: ${response.status}`,
        `\nUrl: ${url}; Options: ${options.headers.Authorization}`);

    const [parseErr, object] = await to(response.json());
    if (parseErr) {
        logger.error(`Error while parsing JSON from ${url}:\n${parseErr}`);
        return;
    }
    return object;
};

const fetchPostJSON = async function(url, basicAuth, body) {
    const options = {
        method: 'POST',
        body,
        headers: {'Authorization': basicAuth, 'content-type': 'application/json'},
        timeout: 11000,
    };
    const [err, response] = await to(fetch(url, options));
    if (err) {
        logger.error(`Error while getting ${url}:\n${err}`);
        return;
    }

    logger.info(`response from jira have status: ${response.status}`,
        `\nUrl: ${url}; Options: ${options.headers.Authorization}`);

    return response;
};

const fetchPutJSON = async function(url, basicAuth, body) {
    const options = {
        method: 'PUT',
        body,
        headers: {'Authorization': basicAuth, 'content-type': 'application/json'},
        timeout: 11000,
    };
    const [err, response] = await to(fetch(url, options));
    if (err) {
        logger.error(`Error while getting ${url}:\n${err}`);
        return;
    }

    logger.info(`response from jira have status: ${response.status}`,
        `\nUrl: ${url}; Options: ${options.headers.Authorization}`);

    return response;
};

const paramsToQueryString = function(params) {
    const toStrings = Ramda.map(Ramda.pipe(
        Ramda.mapObjIndexed((value, key) => `${key}=${value}`),
        Ramda.values
    ));
    return Ramda.ifElse(
        Ramda.isEmpty,
        Ramda.always(''),
        Ramda.pipe(toStrings, Ramda.join('&'), Ramda.concat('?'))
    )(params || []);
};

module.exports = {
    fetchJSON,
    fetchPostJSON,
    fetchPutJSON,
    paramsToQueryString,
};
