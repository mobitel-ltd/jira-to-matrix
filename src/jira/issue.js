// @flow
const R = require('ramda');
const _ = require('lodash');
const conf = require('../config');
const {auth} = require('./common');
const {fetchJSON, paramsToQueryString} = require('../utils');

function refProject(projectKey/* :string*/) {
    return `${conf.jira.url}/projects/${projectKey}`;
}

function ref(issueKey/* :string*/) {
    return `${conf.jira.url}/browse/${issueKey}`;
}

function extractID(json/* :string*/)/* :?string*/ {
    const matches = /\/issue\/(\d+)\//.exec(json);
    if (!matches) {
        return undefined;
    }
    return matches[1];
}

async function collectParticipants(issue/* :{}*/) {
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
}

async function get(id, params/* :Array<{}>*/) {
    const issue = await fetchJSON(
        `${conf.jira.url}/rest/api/2/issue/${id}${paramsToQueryString(params)}`,
        auth()
    );
    return issue;
}

async function getProject(id, params) {
    const issue = await fetchJSON(
        `${conf.jira.url}/rest/api/2/project/${id}${paramsToQueryString(params)}`,
        auth()
    );
    return issue;
}

async function getFormatted(issueID/* :string*/) {
    const params = [{expand: 'renderedFields'}];
    return get(issueID, params);
}

async function renderedValues(issueID/* :string*/, fields/* :string[]*/) {
    const issue = await getFormatted(issueID);
    if (!issue) {
        return undefined;
    }
    return R.pipe(
        R.pick(fields),
        R.filter(v => !!v)
    )(issue.renderedFields);
}

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
