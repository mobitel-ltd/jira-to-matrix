const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const {url: jiraUrl} = require('../config').jira;
const {auth} = require('./common');
const {fetchJSON, paramsToQueryString} = require('../utils');

/**
 * Get url for jira project by key
 * @param {string} key key of jira project
 * @param {string} type by default 'browse', param of url
 * @return {string} url
 */
const ref = (key, type = 'browse') =>
    [jiraUrl, type, key].join('/');

/**
 * Get issue ID from jira webhook
 * @param {object} json jira webhook
 * @return {string} issue ID
 */
const extractID = json => {
    const matches = /\/issue\/(\d+)\//.exec(json);
    if (!matches) {
        logger.warn('matches from jira.issue.extractID is not defained');
        return;
    }
    return matches[1];
};

/**
 * Make jira request to get watchers of issue from url and add to collectParticipantsBody
 * @param {string} url url for request 
 * @param {array} collectParticipantsBody array of users linked to current issue
 * @return {array} jira response with issue
 */
const collectParticipants = async ({url, collectParticipantsBody}) => {
    if (url) {
        const body = await fetchJSON(url, auth());
        if (body && Array.isArray(body.watchers)) {
            const watchers = body.watchers.map(item => item.name);
            collectParticipantsBody.push(...watchers);
        }
    }
    const result = new Set(collectParticipantsBody.filter(Boolean));
    return [...result];
};

/**
 * Make GET request to jira by issueID and params
 * @param {string} id issue ID in jira
 * @param {string} params url params
 * @return {object} jira response with issue
 */
const get = async (id, params) => {
    const url = `${jiraUrl}/rest/api/2/issue/${id}${paramsToQueryString(params)}`;
    logger.debug('url for jira fetch', url);
    const issue = await fetchJSON(
        url,
        auth()
    );
    return issue;
};

/**
 * Make GET request to jira by projectID
 * @param {string} id project ID in jira
 * @return {object} jira response with issue
 */
const getProject = async id => {
    const url = `${jiraUrl}/rest/api/2/project/${id}}`;
    const project = await fetchJSON(
        url,
        auth()
    );
    return project;
};

/**
 * Make request to jira by issueID adding renderedFields
 * @param {string} issueID issue ID in jira
 * @return {object} jira response
 */
const getFormatted = async issueID => {
    const params = [{expand: 'renderedFields'}];
    const result = await get(issueID, params);

    return result;
};

/**
 * Make request to jira by issueID adding renderedFields and filter by fields
 * @param {string} issueID issue ID in jira
 * @param {object} fields fields for filtering
 * @return {object} data from fields
 */
const renderedValues = async (issueID, fields) => {
    const issue = await getFormatted(issueID);
    if (!issue) {
        logger.warn('issue from jira.issue.renderedValues is not defined');

        return;
    }

    return Ramda.pipe(
        Ramda.pick(fields),
        Ramda.filter(value => !!value)
    )(issue.renderedFields);
};

module.exports = {
    ref,
    extractID,
    collectParticipants,
    get,
    getProject,
    getFormatted,
    renderedValues,
};
