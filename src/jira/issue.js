// @flow
const Ramda = require('ramda');
const logger = require('debug')('jira issue');
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
        logger('matches from jira.issue.extractID is not defained');
        return;
    }
    return matches[1];
};

/* :{}*/
const collectParticipants = async issue => {
    const result = [
        _.get(issue, 'fields.creator.name'),
        _.get(issue, 'fields.reporter.name'),
        _.get(issue, 'fields.assignee.name'),
    ];

    const url = _.get(issue, 'fields.watches.self');
    if (url) {
        const body = await fetchJSON(url, auth());
        if (body && body.watchers instanceof Array) {
            const watchers = body.watchers.map(one => one.name);
            result.push(...watchers);
        }
    }
    return _.uniq(result.filter(one => !!one));
};

/* :Array<{}>*/
const get = async (id, params) => {
    const issue = await fetchJSON(
        `${conf.jira.url}/rest/api/2/issue/${id}${paramsToQueryString(params)}`,
        auth()
    );
    return issue;
};

const getProject = async (id, params) => {
    const issue = await fetchJSON(
        `${conf.jira.url}/rest/api/2/project/${id}${paramsToQueryString(params)}`,
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
        logger('issue from jira.issue.renderedValues is not defained');
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
