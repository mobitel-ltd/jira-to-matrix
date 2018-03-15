const Ramda = require('ramda');
const fetch = require('node-fetch');
const logger = require('../modules/log.js')(module);

const FETCH_TIMEOUT = 30000;

const fetchJSON = async (url, basicAuth) => {
    const options = {
        headers: {Authorization: basicAuth},
        timeout: FETCH_TIMEOUT,
    };
    try {
        const response = await fetch(url, options);
        logger.debug(`GET response from jira have status: ${response.status}`,
            `\nUrl: ${url}; Options: ${options.headers.Authorization}`);

        const object = await response.json();

        return object;
    } catch (err) {
        throw [`Error in fetchJSON ${url}`, err].join('\n');
    }
};

const fetchPostJSON = async (url, basicAuth, body) => {
    const options = {
        method: 'POST',
        body,
        headers: {'Authorization': basicAuth, 'content-type': 'application/json'},
        timeout: FETCH_TIMEOUT,
    };
    try {
        const {status} = await fetch(url, options);
        logger.debug('POST response from jira have status:', status);
        logger.debug(`Url: ${url}; Options: ${options.headers.Authorization}`);

        return status;
    } catch (err) {
        throw [`POST Error while getting ${url}: `, err].join('\n');
    }
};

const fetchPutJSON = async (url, basicAuth, body) => {
    const options = {
        method: 'PUT',
        body,
        headers: {'Authorization': basicAuth, 'content-type': 'application/json'},
        timeout: FETCH_TIMEOUT,
    };
    try {
        const response = await fetch(url, options);
        logger.debug(`PUT response from jira have status: ${response.status}`,
            `\nUrl: ${url}; Options: ${options.headers.Authorization}`);

        return response;
    } catch (err) {
        logger.error(`PUT Error while getting ${url}: `, err);

        return null;
    }
};

const paramsToQueryString = params => {
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
