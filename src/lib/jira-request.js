const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const {jira, inviteIgnoreUsers = []} = require('../config');
const {request} = require('./request.js');
const {paramsToQueryString} = require('./utils.js');

const {url: jiraUrl} = jira;
const isExpectedToInvite = name => !inviteIgnoreUsers.includes(name);
/**
 * Get url for jira project by key
 * @param {string} key key of jira project
 * @param {string} type by default 'browse', param of url
 * @return {string} url
 */
const getProjectUrl = (key, type = 'browse') =>
    [jiraUrl, type, key].join('/');


/**
 * Make jira request to get watchers of issue from url and add to collectParticipantsBody
 * @param {string} url url for request
 * @param {array} collectParticipantsBody array of users linked to current issue
 * @return {array} jira response with issue
 */
const getCollectParticipants = async ({url, collectParticipantsBody, watchersUrl}) => {
    try {
        const body = await request(url || watchersUrl);
        const watchers = (body && Array.isArray(body.watchers)) ? body.watchers.map(item => item.name) : [];

        const allWatchersSet = new Set([...collectParticipantsBody, ...watchers]);

        return [...allWatchersSet].filter(isExpectedToInvite);
    } catch (err) {
        throw ['getCollectParticipants error', err].join('\n');
    }
};

/**
 * Make GET request to jira by ID to get linked issues
 * @param {string} id linked issue ID in jira
 * @return {object} jira response with issue
 */
const getLinkedIssue = async id => {
    const body = await request(
        `${jiraUrl}/rest/api/2/issueLink/${id}`,
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
        const url = `${jiraUrl}/rest/api/2/issue/${id}${queryParams}`;
        logger.debug('url for jira request', url);
        const issue = await request(
            url,
        );

        return issue;
    } catch (err) {
        throw ['Error in get issue', err].join('\n');
    }
};

/**
 * Make GET request to jira by projectID
 * @param {string} id project ID in jira
 * @return {object} jira response with issue
 */
const getProject = async id => {
    try {
        const url = `${jiraUrl}/rest/api/2/project/${id}`;
        const project = await request(
            url,
        );

        return project;
    } catch (err) {
        throw ['getProject error', err].join('\n');
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
        throw ['getIssueFormatted Error', err].join('\n');
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
        throw ['getRenderedValues error', err].join('\n');
    }
};

module.exports = {
    getProjectUrl,
    getCollectParticipants,
    getIssue,
    getProject,
    getIssueFormatted,
    getRenderedValues,
    getLinkedIssue,
};
