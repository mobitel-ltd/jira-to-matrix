const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const requestPromise = require('request-promise-native');

const TIMEOUT = 60000;

const request = async (url, basicAuth) => {
    const options = {
        headers: {Authorization: basicAuth},
        timeout: TIMEOUT,
    };
    try {
        const response = await requestPromise(url, options);
        logger.debug(`GET request to jira with Url ${url} suceeded`);
        return JSON.parse(response);
    } catch (err) {
        throw [`Error in request ${url}`, err].join('\n');
    }
};

const requestPost = async (url, basicAuth, body) => {
    const options = {
        method: 'POST',
        body,
        headers: {'Authorization': basicAuth, 'content-type': 'application/json'},
        timeout: TIMEOUT,
    };
    try {
        await requestPromise(url, options);
        logger.debug(`POST request to jira with Url ${url} suceeded`);
    } catch (err) {
        throw [`POST Error while getting ${url}: `, err].join('\n');
    }
};

const requestPut = async (url, basicAuth, body) => {
    const options = {
        method: 'PUT',
        body,
        headers: {'Authorization': basicAuth, 'content-type': 'application/json'},
        timeout: TIMEOUT,
    };
    try {
        await requestPromise(url, options);
        logger.debug(`PUT request to jira with Url ${url} suceeded`);
    } catch (err) {
        throw [`PUT Error while getting ${url}: `, err].join('\n');
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
    request,
    requestPost,
    requestPut,
    paramsToQueryString,
};
