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
const getProjectUrl = (key, type = 'browse') =>
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
const getCollectParticipants = async ({url, collectParticipantsBody}) => {
    try {
        const body = await fetchJSON(url, auth());
        if (body && Array.isArray(body.watchers)) {
            const watchers = body.watchers.map(item => item.name);
            collectParticipantsBody.push(...watchers);
        }

        const result = new Set(collectParticipantsBody.filter(Boolean));

        return [...result];
    } catch (err) {
        logger.error('getCollectParticipants error');

        throw err;
    }
};

/**
 * Make GET request to jira by ID to get linked issues
 * @param {string} id linked issue ID in jira
 * @return {object} jira response with issue
 */
const getLinkedIssue = async id => {
    const body = await fetchJSON(
        `${jiraUrl}/rest/api/2/issueLink/${id}`,
        auth()
    );

    return body;
};

/**
 * Make GET request to jira by issueID and params
 * @param {string} id issue ID in jira
 * @param {string} params url params
 * @return {object} jira response with issue
 */
const getIssue = async (id, params) => {
    try {
        const queryParams = paramsToQueryString(params);
        logger.debug('query', queryParams);
        const url = `${jiraUrl}/rest/api/2/issue/${id}${queryParams}`;
        logger.debug('url for jira fetch', url);
        const issue = await fetchJSON(
            url,
            auth()
        );

        return issue;
    } catch (err) {
        logger.error('Error in get issue');

        throw err;
    }
};

/**
 * Make GET request to jira by projectID
 * @param {string} id project ID in jira
 * @return {object} jira response with issue
 */
const getProject = async id => {
    try {
        const url = `${jiraUrl}/rest/api/2/project/${id}}`;
        const project = await fetchJSON(
            url,
            auth()
        );

        return project;
    } catch (err) {
        logger.error('getProject error');

        throw err;
    }
};

/**
 * Make request to jira by issueID adding renderedFields
 * @param {string} issueID issue ID in jira
 * @return {object} jira response
 */
const getIssueFormatted = async issueID => {
    try {
        const params = [{expand: 'renderedFields'}];
        const result = await getIssue(issueID, params);

        return result;
    } catch (err) {
        logger.error('getIssueFormatted Error');
        throw err;
    }
};

/**
 * Make request to jira by issueID adding renderedFields and filter by fields
 * @param {string} issueID issue ID in jira
 * @param {object} fields fields for filtering
 * @return {object} data from fields
 */
const getRenderedValues = async (issueID, fields) => {
    try {
        const issue = await getIssueFormatted(issueID);

        const renderedValues = Ramda.pipe(
            Ramda.pick(fields),
            Ramda.filter(value => !!value)
        )(issue.renderedFields);

        return renderedValues;
    } catch (err) {
        logger.error('getRenderedValues error');

        throw err;
    }
};

module.exports = {
    getProjectUrl,
    extractID,
    getCollectParticipants,
    getIssue,
    getProject,
    getIssueFormatted,
    getRenderedValues,
    getLinkedIssue,
};
