const querystring = require('querystring');
const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const { jira, inviteIgnoreUsers = [] } = require('../config');
const { request, requestPost, requestPut } = require('./request.js');
const utils = require('./utils.js');
const messages = require('./messages');
const schemas = require('./schemas');

const { url: jiraUrl } = jira;

const isExpectedToInvite = name => name && !inviteIgnoreUsers.includes(name);

// Checking occurrences of current name

const jiraRequests = {
    checkUser: ({ name, displayName }, expectedName) =>
        name.toLowerCase().includes(expectedName.toLowerCase()) ||
        displayName.toLowerCase().includes(expectedName.toLowerCase()),

    postComment: (roomName, sender, bodyText) => {
        const url = utils.getRestUrl('issue', roomName, 'comment');

        return requestPost(url, schemas.comment(sender, bodyText));
    },

    postIssueStatus: (roomName, id) => {
        const url = utils.getRestUrl('issue', roomName, 'transitions');

        return requestPost(url, schemas.move(id));
    },

    getPossibleIssueStatuses: async roomName => {
        const url = utils.getRestUrl('issue', roomName, 'transitions');
        const { transitions } = await request(url);

        return transitions;
    },

    getIssuePriorities: async roomName => {
        const url = utils.getRestUrl('issue', roomName, 'editmeta');
        const res = await request(url);

        return Ramda.path(['fields', 'priority', 'allowedValues'], res);
    },

    updateIssuePriority: (roomName, id) => {
        const url = utils.getRestUrl('issue', roomName);

        return requestPut(url, schemas.fields(id));
    },

    testJiraRequest: async () => {
        try {
            const pingJira = () => request(jiraUrl);
            const res = await utils.connect(pingJira, utils.PING_INTERVAL, utils.PING_COUNT);

            return res;
        } catch (err) {
            logger.error(messages.noJiraConnection, err);

            throw messages.noJiraConnection;
        }
    },

    /**
     * Make jira request to get watchers of issue from url and add to roomMembers
     * @param {string} key issue key
     * @param {array} roomMembers array of users linked to current issue
     * @return {array} jira response with issue
     */
    getIssueWatchers: async ({ key }) => {
        const url = utils.getRestUrl('issue', key, 'watchers');
        const body = await request(url);
        const watchers = body && Array.isArray(body.watchers) ? body.watchers.map(item => item.name) : [];

        const issue = await jiraRequests.getIssue(key);
        const roomMembers = utils.handleIssueAsHook.getMembers({ issue });

        const allWatchersSet = new Set([...roomMembers, ...watchers]);

        return [...allWatchersSet].filter(isExpectedToInvite);
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
            const issue = await request(url, { qs: params });

            return issue;
        } catch (err) {
            throw ['Error in get issue', err].join('\n');
        }
    },
    createIssue: ({ summary, issueTypeId, projectId, parentId, isEpic, isSubtask, styleProject }) => {
        const uri = utils.getRestUrl('issue');

        if (isSubtask || (isEpic && styleProject !== 'classic')) {
            return requestPost(uri, schemas.issueChild(summary, issueTypeId, projectId, parentId));
        }

        return requestPost(uri, schemas.issueNotChild(summary, issueTypeId, projectId));
    },

    createEpicLinkClassic: (issueKey, parentId) => {
        const uri = utils.getRestUrl('issue', issueKey);

        return requestPut(uri, schemas.issueEpicLink(parentId));
    },

    createIssueLink: (issueKey1, issueKey2) => {
        const uri = utils.getRestUrl('issueLink');

        return requestPost(uri, schemas.issueLink(issueKey1, issueKey2));
    },

    /**
     * Make GET request to jira by projectID
     * @param {string} projectKey project ID in jira
     * @return {Promise<{key: string, id: number, name: str}>} jira response with issue
     */
    getProject: async projectKey => {
        const projectBody = await request(utils.getRestUrl('project', projectKey));
        const {
            id,
            key,
            lead: { key: leadKey, name: leadName },
            name,
            issueTypes,
            roles: { Administrator = '', Administrators = '' },
            isPrivate,
            style,
        } = projectBody;

        const adminsURL = Administrators || Administrator;
        const isIgnore = isPrivate && style === 'new-gen';

        const project = {
            id,
            key,
            lead: { name: leadName, key: leadKey },
            name,
            issueTypes: issueTypes.map(({ id, name, description, subtask }) => ({ id, name, description, subtask })),
            adminsURL,
            isIgnore,
            style,
        };

        return project;
    },

    getProjectWithAdmins: async projectKey => {
        const projectBody = await jiraRequests.getProject(projectKey);
        const { adminsURL } = projectBody;

        try {
            const { actors = [{ name: '' }] } = await request(adminsURL);
            const admins = [
                ...actors.map(({ id, name }) => ({
                    id,
                    name,
                })),
            ];

            return { ...projectBody, admins };
        } catch (err) {
            logger.warn('Not admins from request', err);

            return projectBody;
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
     * @param {string} key issue key in jira
     * @param {object} fields fields for filtering
     * @return {object} data from fields
     */
    getRenderedValues: async (key, fields) => {
        try {
            const issue = await jiraRequests.getIssueFormatted(key);

            const renderedValues = Ramda.pipe(
                Ramda.pick(fields),
                Ramda.filter(value => !!value),
            )(issue.renderedFields);

            return renderedValues;
        } catch (err) {
            throw ['getRenderedValues error', err].join('\n');
        }
    },

    getUsersByParam: username => {
        const queryPararms = querystring.stringify({ username });
        const url = utils.getRestUrl('user', `search?${queryPararms}`);

        return request(url);
    },

    // Search users by part of name
    searchUser: async name => {
        if (!name) {
            return [];
        }
        const allUsers = await jiraRequests.getUsersByParam(name);

        return allUsers.reduce((prev, cur) => (jiraRequests.checkUser(cur, name) ? [...prev, cur] : prev), []);
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

        return requestPost(watchersUrl, schemas.watcher(name));
    },

    addAssignee: (name, roomName) => {
        const assigneeUrl = utils.getRestUrl('issue', roomName, 'assignee');

        return requestPut(assigneeUrl, schemas.assignee(name));
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

    getStatusData: async statusId => {
        try {
            const statusUrl = utils.getRestUrl('status', statusId);

            const data = await request(statusUrl);

            return { colorName: Ramda.path(['statusCategory', 'colorName'], data) };
        } catch (error) {
            logger.error(error);

            return {};
        }
    },
};

module.exports = jiraRequests;
