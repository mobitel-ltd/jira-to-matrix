// @flow
const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const _ = require('lodash');
const conf = require('../config');
const {auth} = require('./common');
const {fetchJSON, paramsToQueryString} = require('../utils');

/* :string*/
const refProject = projectKey => `${conf.jira.url}/projects/${projectKey}`;

/* :string*/
const ref = issueKey => `${conf.jira.url}/browse/${issueKey}`;

/* :string*/
/* :?string*/
const extractID = json => {
    const matches = /\/issue\/(\d+)\//.exec(json);
    if (!matches) {
        logger.warn('matches from jira.issue.extractID is not defained');
        return;
    }
    return matches[1];
};

/* :{}*/
const collectParticipants = async ({url, collectParticipantsBody}) => {
    if (url) {
        const body = await fetchJSON(url, auth());
        if (body && body.watchers instanceof Array) {
            const watchers = body.watchers.map(one => one.name);
            collectParticipantsBody.push(...watchers);
        }
    }
    return _.uniq(collectParticipantsBody.filter(one => !!one));
};

/* :Array<{}>*/
const get = async (id, params) => {
    const url = `${conf.jira.url}/rest/api/2/issue/${id}${paramsToQueryString(params)}`;
    logger.debug('url for jira fetch', url);
    const issue = await fetchJSON(
        url,
        auth()
    );
    return issue;
};

const getProject = async (id, params) => {
    const url = `${conf.jira.url}/rest/api/2/project/${id}${paramsToQueryString(params)}`;
    const issue = await fetchJSON(
        url,
        auth()
    );
    return issue;
};

/* :string*/
const getFormatted = issueID => {
    const params = [{expand: 'renderedFields'}];
    return get(issueID, params);
};

/* :string*/
/* :string[]*/
const renderedValues = async (issueID, fields) => {
    const issue = await getFormatted(issueID);
    if (!issue) {
        logger.warn("'issue' from jira.issue.renderedValues is not defained");
        return;
    }
    return Ramda.pipe(
        Ramda.pick(fields),
        Ramda.filter(value => !!value)
    )(issue.renderedFields);
};

module.exports = {
    refProject,
    ref,
    extractID,
    collectParticipants,
    get,
    getProject,
    getFormatted,
    renderedValues,
};
