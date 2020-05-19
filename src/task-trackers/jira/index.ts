import requestPromise from 'request-promise-native';
import querystring from 'querystring';
import R from 'ramda';
import { getLogger } from '../../modules/log.js';
import * as utils from '../../lib/utils';
import * as messages from '../../lib/messages';
import { schemas } from './schemas';
import delay from 'delay';

const logger = getLogger(module);

/**
 * @typedef Issue
 * @property {string} id issue id
 * @property {string} key issue key
 */

export class Jira {
    url: string;
    user: string;
    password: string;
    ignoreUsers: string[];
    restVersion: string;
    pingInterval: number;
    pingCount: number;
    expandParams: { expand: string };

    /**
     * @param  {object} options constructor options
     * @param  {string} options.url jira url
     * @param  {string} options.user jira user
     * @param  {string} options.password jira password
     * @param  {string} options.ignoreUsers users to ignore
     * @param  {number} [options.interval] ping interval
     * @param  {number} [options.count] ping count
     */
    constructor({ url, user, ignoreUsers, password, interval, count }) {
        this.url = url;
        this.user = user;
        this.password = password;
        this.ignoreUsers = ignoreUsers;
        this.restVersion = 'rest/api/2';
        this.pingInterval = interval || 500;
        this.pingCount = count || 10;
        this.expandParams = { expand: 'renderedFields' };
    }

    /**
     * @returns {{ expand: 'renderedFields' }} query object
     */
    static get expandParams() {
        return this.expandParams;
    }

    /**
     * Create jira url
     *
     * @param  {string[]} args request params
     * @returns {string} url
     */
    getUrl(...args) {
        return [this.url, this.restVersion, ...args].join('/');
    }

    /**
     * Get token
     *
     * @returns {string} auth token
     */
    get token() {
        const encoded = Buffer.from(`${this.user}:${this.password}`).toString('base64');

        return `Basic ${encoded}`;
    }

    /**
     * @param  {string} url request url
     * @param  {object} newOptions request options
     * @returns {Promise<object>} result of request
     */
    async request(url, newOptions) {
        const options = {
            method: 'GET',
            headers: { Authorization: this.token, 'content-type': 'application/json' },
            timeout: utils.TIMEOUT,
            ...newOptions,
        };
        try {
            const response = await requestPromise(url, options);
            logger.debug(`${options.method} request to jira with Url ${url} suceeded`);
            if (['GET', 'POST', 'PUT'].includes(options.method) && url !== this.url && response) {
                return JSON.parse(response);
            }
        } catch (err) {
            throw messages.getRequestErrorLog(url, err.statusCode, options);
        }
    }

    /**
     * POST request
     *
     * @param  {string} url url
     * @param  {object} body request body
     * @returns {object} request result
     */
    requestPost(url, body) {
        const options = {
            method: 'POST',
            body,
        };

        return request(url, options);
    }

    /**
     * PUT request
     *
     * @param  {string} url url
     * @param  {object} body request body
     * @returns {object} request result
     */
    requestPut(url, body) {
        const options = {
            method: 'PUT',
            body,
        };

        return request(url, options);
    }

    /**
     * Check if user can be invited
     *
     * @param  {string} name user name
     * @returns {boolean} true if can be invite
     */
    _isExpectedToInvite(name) {
        return name && !this.ignoreUsers.includes(name);
    }

    /**
     * Check if user display name includes name part
     *
     * @param  {string} displayName user displayName
     * @param  {string} expectedName user name
     * @returns {boolean} is string display name includes name part
     */
    checkUser(displayName, expectedName) {
        return displayName.toLowerCase().includes(expectedName.toLowerCase());
    }

    /**
     * Post comment to issue
     *
     * @param  {string} keyOrId issue key or id
     * @param  {string} sender sender dispaly name
     * @param  {string} bodyText message text
     * @returns {Promise<void>} void
     */
    async postComment(keyOrId, sender, bodyText) {
        const url = this.getUrl('issue', keyOrId, 'comment');

        await requestPost(url, schemas.comment(sender, bodyText));
    }

    /**
     * Set issue to special transition
     *
     * @param {string} keyOrId issue key or id
     * @param {string} id transition id
     * @returns {Promise<void>} void
     */
    async postIssueStatus(keyOrId, id) {
        const url = this.getUrl('issue', keyOrId, 'transitions');

        await requestPost(url, schemas.move(id));
    }

    /**
     * Get all issue transitions
     *
     * @param {string} keyOrId issue key or id
     * @returns {Promise<object[]>} list of transitions
     */
    async getPossibleIssueStatuses(keyOrId) {
        const url = this.getUrl('issue', keyOrId, 'transitions');
        const { transitions } = await request(url);

        return transitions;
    }

    /**
     * Get all issue priorities
     *
     * @param {string} keyOrId issue key or id
     * @returns {Promise<object[]>} list of issue priorities
     */
    async getIssuePriorities(keyOrId) {
        const url = this.getUrl('issue', keyOrId, 'editmeta');
        const res = await request(url);

        return R.path(['fields', 'priority', 'allowedValues'], res);
    }

    /**
     * Update issue priorities
     *
     * @param {string} keyOrId issue key or id
     * @param {string} priorityId priority id
     * @returns {Promise<void>} list of priorities
     */
    async updateIssuePriority(keyOrId, priorityId) {
        const url = this.getUrl('issue', keyOrId);

        await requestPut(url, schemas.fields(priorityId));
    }

    /**
     * @param  {Function} func function
     * @param  {number} interval interval
     * @param  {number} count time to repeat
     */
    async _connect(func, interval, count) {
        if (count === 0) {
            throw new Error('No connection.');
        }
        try {
            await func();
        } catch (err) {
            await delay(interval);
            await this._connect(func, interval, count - 1);
        }
    }

    /**
     * Ping tasktracker
     *
     * @returns {Promise<void>} void
     */
    async testJiraRequest() {
        try {
            const pingJira = () => request(this.url);
            await this._connect(pingJira, this.pingInterval, this.pingCount);
        } catch (err) {
            logger.error(messages.noJiraConnection, err);

            throw messages.noJiraConnection;
        }
    }

    /**
     * Make jira request to get all watchers, assign, creator and reporter of issue from url
     *
     * @param {string} keyOrId issue key
     * @returns {Promise<string[]>} roomMembers array of users linked to current issue except jira bot
     */
    async getIssueWatchers(keyOrId) {
        const url = this.getUrl('issue', keyOrId, 'watchers');
        const body = await request(url);
        const watchers = body && Array.isArray(body.watchers) ? body.watchers.map(item => utils.extractName(item)) : [];

        const issue = await this.getIssue(keyOrId);
        const roomMembers = utils.getIssueMembers(issue);

        const allWatchersSet = new Set([...roomMembers, ...watchers]);

        return [...allWatchersSet].filter(this._isExpectedToInvite).filter(user => !user.includes(this.user));
    }

    /**
     * Make GET request to jira by ID to get linked issues
     *
     * @param {string} id linked issue ID in jira
     * @returns {Promise<Issue>} jira response with issue
     */
    async getLinkedIssue(id) {
        try {
            const body = await request(this.getUrl('issueLink', id));

            return body;
        } catch (err) {
            throw ['Error in getLinkedIssue', err].join('\n');
        }
    }

    /**
     * Make GET request to jira by issueID and params
     *
     * @param {string} keyOrId issue ID or key in jira
     * @param {object} [params] url query params
     * @returns {Promise<Issue>} jira response with issue
     */
    async getIssue(keyOrId, params) {
        try {
            const url = this.getUrl('issue', keyOrId);
            const issue = await request(url, { qs: params });

            return issue;
        } catch (err) {
            throw ['Error in get issue', err].join('\n');
        }
    }

    /**
     * Create issue
     *
     * @param {object} options create issue options
     * @param  {string} options.summary issue summary
     * @param  {string} options.issueTypeId issue issueTypeId
     * @param  {string} options.projectId issue projectId
     * @param  {string} options.parentId issue parentId
     * @param  {boolean} options.isEpic issue isEpic
     * @param  {boolean} options.isSubtask issue isSubtask
     * @param  {string} options.styleProject issue styleProject
     * @returns {object} issue
     */
    createIssue({ summary, issueTypeId, projectId, parentId, isEpic, isSubtask, styleProject }) {
        const uri = this.getUrl('issue');

        if (isSubtask || (isEpic && styleProject !== 'classic')) {
            return requestPost(uri, schemas.issueChild(summary, issueTypeId, projectId, parentId));
        }

        return requestPost(uri, schemas.issueNotChild(summary, issueTypeId, projectId));
    }

    /**
     * Create link with issue
     *
     * @param  {string} issueKey issue key
     * @param  {string} parentId issue parent id
     */
    async createEpicLinkClassic(issueKey, parentId) {
        const uri = this.getUrl('issue', issueKey);

        await requestPut(uri, schemas.issueEpicLink(parentId));
    }

    /**
     * Create issue link
     *
     * @param  {string} issueKey1 issue key
     * @param  {string} issueKey2 issue key
     */
    async createIssueLink(issueKey1, issueKey2) {
        const uri = this.getUrl('issueLink');

        await requestPost(uri, schemas.issueLink(issueKey1, issueKey2));
    }

    /**
     * Make GET request to jira by project id or key
     *
     * @param {string} keyOrId project ID in jira
     * @returns {Promise<{key: string, id: number, name: string, lead: string, issueTypes: Array<{ id: number, name: string, description: string, subtask: any }>, adminsURL: string, isIgnore: boolean, style: string}>} jira response with issue
     */
    async getProject(keyOrId) {
        const projectBody = await request(this.getUrl('project', keyOrId));
        const {
            id,
            key,
            lead: { displayName },
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
            lead: displayName,
            name,
            issueTypes: issueTypes.map(({ id, name, description, subtask }) => ({ id, name, description, subtask })),
            adminsURL,
            isIgnore,
            style,
        };

        return project;
    }

    /**
     * Check if project with such key or id exists
     *
     * @param  {string} keyOrId issue key or id
     * @returns {Promise<boolean>} true if issue exists
     */
    async isJiraPartExists(keyOrId) {
        const projectKey = utils.getProjectKeyFromIssueKey(keyOrId);
        try {
            await this.getProject(projectKey);
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * @typedef Project
     * @property {string} key project key
     * @property {number} id project id
     * @property {string} name project name
     * @property {string} lead project lead
     * @property {string[]} [admins] project admins
     */

    /**
     * Make GET request to jira by projectID
     *
     * @param {string} projectKey project ID in jira
     * @returns {Promise<Project>} jira response with issue
     */
    async getProjectWithAdmins(projectKey) {
        const projectBody = await this.getProject(projectKey);
        const { adminsURL } = projectBody;

        try {
            const { actors } = await request(adminsURL);
            const admins = actors.map(item => utils.extractName(item));

            return { ...projectBody, admins };
        } catch (err) {
            logger.warn('Not admins from request', err);

            return projectBody;
        }
    }

    /**
     * Make request to jira by issueID adding renderedFields
     *
     * @param {string} issueID issue ID in jira
     * @returns {Promise<object>} jira response
     */
    async getIssueFormatted(issueID) {
        try {
            const result = await this.getIssue(issueID, this.expandParams);

            return result;
        } catch (err) {
            throw ['getIssueFormatted Error', err].join('\n');
        }
    }

    /**
     * Make request to jira by issueID adding renderedFields and filter by fields
     *
     * @param {string} key issue key in jira
     * @param {object} fields fields for filtering
     * @returns {Promise<object>} data from fields
     */
    async getRenderedValues(key, fields) {
        try {
            const issue = await this.getIssueFormatted(key);

            const renderedValues = R.pipe(
                R.pick(fields),
                R.filter(value => !!value),
            )(issue.renderedFields);

            return renderedValues;
        } catch (err) {
            throw ['getRenderedValues error', err].join('\n');
        }
    }

    /**
     * Get user list by part of the name
     *
     * @param  {string} [partName] part of displayname
     * @returns {Promise<object[]>} users collection
     */
    async searchUser(partName) {
        if (!partName) {
            return [];
        }
        const queryPararms = querystring.stringify({ query: partName });
        const url = this.getUrl('user', `search?${queryPararms}`);
        const allUsers = await request(url);

        return allUsers.filter(user => this.checkUser(user.displayName, partName));
    }

    /**
     * Add watcher to issue
     *
     * @param  {string} accountId user account id
     * @param  {string} keyOrId issue key or id
     */
    async addWatcher(accountId, keyOrId) {
        const watchersUrl = this.getUrl('issue', keyOrId, 'watchers');

        await requestPost(watchersUrl, schemas.watcher(accountId));
    }

    /**
     * Add assign to issue
     *
     * @param  {string} accountId user account id
     * @param  {string} keyOrId issue key or id
     */
    async addAssignee(accountId, keyOrId) {
        const assigneeUrl = this.getUrl('issue', keyOrId, 'assignee');

        await requestPut(assigneeUrl, schemas.assignee(accountId));
    }

    /**
     * Get issue without throw on error
     *
     * @param  {string} keyOrId issue key or id
     * @returns {Promise<Issue|boolean>} return false Issue or issue if not found
     */
    async getIssueSafety(keyOrId) {
        try {
            const issue = await this.getIssue(keyOrId);

            return issue;
        } catch (err) {
            logger.warn(`No issue by ${keyOrId}`);
            return false;
        }
    }

    /**
     * Check if issue exists
     *
     * @param {string} keyOrId jira issue key or id
     * @returns {Promise<boolean>} true if exists
     */
    async hasIssue(keyOrId) {
        const res = await this.getIssueSafety(keyOrId);

        return Boolean(res);
    }

    /**
     * Get status data with color
     *
     * @param  {string} statusId issue status id
     * @returns {Promise<object>} status data with color
     */
    async getStatusData(statusId) {
        try {
            const statusUrl = this.getUrl('status', statusId);

            const data = await request(statusUrl);

            return { colorName: R.path(['statusCategory', 'colorName'], data) };
        } catch (error) {
            logger.error(error);

            return {};
        }
    }

    /**
     * Get last created issue key in project
     *
     * @param  {string} projectKey project key
     * @returns {Promise<string|undefined>} issue key
     */
    async getLastIssueKey(projectKey) {
        try {
            const searchUrl = this.getUrl('search');

            const data = await request(searchUrl, {
                qs: {
                    jql: `project=${projectKey}`,
                },
            });

            return R.path(['issues', '0', 'key'], data);
        } catch (error) {
            const msg = utils.errorTracing(`Not found or not available project ${projectKey}`, error);
            logger.error(msg);
        }
    }

    /**
     * Check if status exists in project
     *
     * @param  {string} projectKey project key
     * @param  {string} status status
     * @returns {Promise<boolean>} true if exists
     */
    async hasStatusInProject(projectKey, status) {
        const issuKey = await this.getLastIssueKey(projectKey);
        if (issuKey) {
            const transitions = await this.getPossibleIssueStatuses(issuKey);

            return transitions.some(el => el.to.name === status);
        }

        return false;
    }

    /**
     * Get issue current status
     *
     * @param  {string} keyOrId issue key or id
     * @returns {Promise<string>} issue status name
     */
    async getCurrentStatus(keyOrId) {
        const issue = await this.getIssueSafety(keyOrId);

        return R.path(['fields', 'status', 'name'], issue);
    }
}
