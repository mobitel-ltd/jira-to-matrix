const {schemaWatcher, schemaAssignee} = require('../matrix/timeline-handler/commands/schemas');
const querystring = require('querystring');
const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const {jira, inviteIgnoreUsers = []} = require('../config');
const {request, requestPost, requestPut} = require('./request.js');
const utils = require('./utils.js');
const messages = require('./messages');

const {url: jiraUrl} = jira;

const isExpectedToInvite = name => name && !inviteIgnoreUsers.includes(name);

const jiraRequests = {
    testJiraRequest: async () => {
        try {
            const res = await request(jiraUrl);

            return res;
        } catch (err) {
            logger.error(messages.noJiraConnection, err);

            throw messages.noJiraConnection;
        }
    },

    /**
     * Make jira request to get watchers of issue from url and add to roomMembers
     * @param {string} url url for request
     * @param {array} roomMembers array of users linked to current issue
     * @return {array} jira response with issue
     */
    getIssueWatchers: async ({url, roomMembers, watchersUrl}) => {
        const correctUrl = url || watchersUrl;

        try {
            const body = correctUrl && await request(correctUrl);
            const watchers = (body && Array.isArray(body.watchers)) ? body.watchers.map(item => item.name) : [];

            const allWatchersSet = new Set([...roomMembers, ...watchers]);

            return [...allWatchersSet].filter(isExpectedToInvite);
        } catch (err) {
            throw ['getIssueWatchers error', err].join('\n');
        }
    },

    /**
     * Make GET request to jira by ID to get linked issues
     * @param {string} id linked issue ID in jira
     * @return {object} jira response with issue
     */
    getLinkedIssue: async id => {
        try {
            const body = await request(utils.getRestUrl('issueLink', id));

            return body;
        } catch (err) {
            throw ['Error in getLinkedIssue', err].join('\n');
        }
    },

    /**
     * Make GET request to jira by issueID and params
     * @param {string} id issue ID in jira
     * @param {string} params url params
     * @return {object} jira response with issue
     */
    getIssue: async (id, params) => {
        try {
            const url = utils.getRestUrl('issue', id);
            const issue = await request(url, {qs: params});

            return issue;
        } catch (err) {
            throw ['Error in get issue', err].join('\n');
        }
    },

    /**
     * Make GET request to jira by projectID
     * @param {string} id project ID in jira
     * @return {object} jira response with issue
     */
    getProject: async id => {
        try {
            const project = await request(utils.getRestUrl('project', id));

            return project;
        } catch (err) {
            throw ['getProject error', err].join('\n');
        }
    },

    /**
     * Make request to jira by issueID adding renderedFields
     * @param {string} issueID issue ID in jira
     * @return {object} jira response
     */
    getIssueFormatted: async issueID => {
        try {
            const result = await jiraRequests.getIssue(issueID, utils.expandParams);

            return result;
        } catch (err) {
            throw ['getIssueFormatted Error', err].join('\n');
        }
    },

    /**
     * Make request to jira by issueID adding renderedFields and filter by fields
     * @param {string} issueID issue ID in jira
     * @param {object} fields fields for filtering
     * @return {object} data from fields
     */
    getRenderedValues: async (issueID, fields) => {
        try {
            const issue = await jiraRequests.getIssueFormatted(issueID);

            const renderedValues = Ramda.pipe(
                Ramda.pick(fields),
                Ramda.filter(value => !!value)
            )(issue.renderedFields);

            return renderedValues;
        } catch (err) {
            throw ['getRenderedValues error', err].join('\n');
        }
    },

    getUsersByParam: username => {
        try {
            const queryPararms = querystring.stringify({username});
            const url = utils.getRestUrl('user', `search?${queryPararms}`);

            return request(url);
        } catch (err) {
            throw utils.errorTracing('getUserByParam', err);
        }
    },

    // recursive function to get users by num and startAt (start position in jira list of users)
    getUsers: async (maxResults, startAt, acc = []) => {
        try {
            const params = {
                username: utils.COMMON_NAME,
                startAt,
                maxResults,
            };

            const queryPararms = querystring.stringify(params);
            const url = utils.getRestUrl('user', `search?${queryPararms}`);

            const users = await request(url);
            let resultAcc = [...acc, ...users];
            if (users.length >= maxResults) {
                resultAcc = await jiraRequests.getUsers(maxResults, startAt + maxResults, resultAcc);
            }

            return resultAcc;
        } catch (err) {
            throw utils.errorTracing('getUsers', err);
        }
    },

    addWatcher: (name, roomName) => {
        const watchersUrl = utils.getRestUrl('issue', roomName, 'watchers');

        return requestPost(watchersUrl, schemaWatcher(name));
    },

    addAssignee: (name, roomName) => {
        const assigneeUrl = utils.getRestUrl('issue', roomName, 'assignee');

        return requestPut(assigneeUrl, schemaAssignee(name));
    },

    getIssueSafety: async id => {
        try {
            const issue = await jiraRequests.getIssue(id);

            return issue;
        } catch (err) {
            logger.warn('No issue by ', id);
            return false;
        }
    },
};

module.exports = jiraRequests;
