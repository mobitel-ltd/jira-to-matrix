import requestPromise from 'request-promise-native';
import querystring from 'querystring';
import * as R from 'ramda';
import { getLogger } from '../../modules/log';
import * as utils from '../../lib/utils';
import * as messages from '../../lib/messages';
import { schemas } from './schemas';
import delay from 'delay';
import { Issue, RenderedIssue, Transition, Project } from '../../types/index';

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

    static expandParams = { expand: 'renderedFields' };

    /**
     * Create jira url
     */
    getUrl(...args: string[]): string {
        return [this.url, this.restVersion, ...args].join('/');
    }

    get token(): string {
        const encoded = Buffer.from(`${this.user}:${this.password}`).toString('base64');

        return `Basic ${encoded}`;
    }

    async request(url: string, newOptions?: requestPromise.RequestPromiseOptions): Promise<any> {
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
     */
    requestPost(url: string, body: string): Promise<any> {
        const options = {
            method: 'POST',
            body,
        };

        return this.request(url, options);
    }

    /**
     * PUT request
     */
    requestPut(url: string, body: string): Promise<any> {
        const options = {
            method: 'PUT',
            body,
        };

        return this.request(url, options);
    }

    /**
     * Check if user can be invited
     *
     * @param  {string} name user name
     * @returns {boolean} true if can be invite
     */
    _isExpectedToInvite(name: string): boolean {
        return Boolean(name && !this.ignoreUsers.includes(name));
    }

    /**
     * Check if user display name includes name part
     */
    checkUser(displayName: string, expectedName: string): boolean {
        return displayName.toLowerCase().includes(expectedName.toLowerCase());
    }

    /**
     * Post comment to issue
     */
    async postComment(keyOrId: string, sender: string, bodyText: string): Promise<void> {
        const url = this.getUrl('issue', keyOrId, 'comment');

        await this.requestPost(url, schemas.comment(sender, bodyText));
    }

    /**
     * Set issue to special transition
     */
    async postIssueStatus(keyOrId: string, id: string): Promise<void> {
        const url = this.getUrl('issue', keyOrId, 'transitions');

        await this.requestPost(url, schemas.move(id));
    }

    /**
     * Get all issue transitions
     */
    async getPossibleIssueStatuses(keyOrId: string): Promise<Transition[]> {
        const url = this.getUrl('issue', keyOrId, 'transitions');
        const { transitions } = await this.request(url);

        return transitions;
    }

    /**
     * Get all issue priorities
     */
    async getIssuePriorities(keyOrId: string): Promise<any[] | undefined> {
        const url = this.getUrl('issue', keyOrId, 'editmeta');
        const res = await this.request(url);

        return R.path(['fields', 'priority', 'allowedValues'], res);
    }

    /**
     * Update issue priorities
     */
    async updateIssuePriority(keyOrId: string, priorityId: string): Promise<void> {
        const url = this.getUrl('issue', keyOrId);

        await this.requestPut(url, schemas.fields(priorityId));
    }

    async _connect(func: Function, interval: number, count: number) {
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
     */
    async testJiraRequest(): Promise<void> {
        try {
            const pingJira = () => this.request(this.url);
            await this._connect(pingJira, this.pingInterval, this.pingCount);
        } catch (err) {
            logger.error(messages.noJiraConnection, err);

            throw messages.noJiraConnection;
        }
    }

    /**
     * Make jira request to get all watchers, assign, creator and reporter of issue from url
     */
    async getIssueWatchers(keyOrId: string): Promise<string[]> {
        const url = this.getUrl('issue', keyOrId, 'watchers');
        const body = await this.request(url);
        const watchers = body && Array.isArray(body.watchers) ? body.watchers.map(item => utils.extractName(item)) : [];

        const issue = await this.getIssue(keyOrId);
        const roomMembers = utils.getIssueMembers(issue);

        const allWatchersSet = new Set([...roomMembers, ...watchers]);

        return [...allWatchersSet]
            .filter(user => this._isExpectedToInvite(user))
            .filter(user => !user.includes(this.user));
    }

    /**
     * Make GET request to jira by ID to get linked issues
     */
    async getLinkedIssue(id) {
        try {
            const body = await this.request(this.getUrl('issueLink', id));

            return body;
        } catch (err) {
            throw ['Error in getLinkedIssue', err].join('\n');
        }
    }

    /**
     * Make GET request to jira by issueID and params
     */
    async getIssue(keyOrId: string): Promise<Issue>;
    async getIssue(keyOrId: string, params: object): Promise<RenderedIssue>;
    async getIssue(keyOrId: string, params?: any): Promise<Issue | RenderedIssue> {
        try {
            const url = this.getUrl('issue', keyOrId);
            const issue = await this.request(url, { qs: params });

            return issue;
        } catch (err) {
            throw ['Error in get issue', err].join('\n');
        }
    }

    /**
     * Create issue
     */
    createIssue({
        summary,
        issueTypeId,
        projectId,
        parentId,
        isEpic,
        isSubtask,
        styleProject,
    }: {
        summary: string;
        issueTypeId: string;
        projectId: string;
        parentId: string;
        isEpic: boolean;
        isSubtask: boolean;
        styleProject: string;
    }): Promise<Issue> {
        const uri = this.getUrl('issue');

        if (isSubtask || (isEpic && styleProject !== 'classic')) {
            return this.requestPost(uri, schemas.issueChild(summary, issueTypeId, projectId, parentId));
        }

        return this.requestPost(uri, schemas.issueNotChild(summary, issueTypeId, projectId));
    }

    /**
     * Create link with issue
     */
    async createEpicLinkClassic(issueKey: string, parentId: string) {
        const uri = this.getUrl('issue', issueKey);

        await this.requestPut(uri, schemas.issueEpicLink(parentId));
    }

    /**
     * Create issue link
     */
    async createIssueLink(issueKey1: string, issueKey2: string) {
        const uri = this.getUrl('issueLink');

        await this.requestPost(uri, schemas.issueLink(issueKey1, issueKey2));
    }

    /**
     * Make GET request to jira by project id or key
     */
    async getProject(
        keyOrId: string,
    ): Promise<{
        key: string;
        id: string;
        name: string;
        lead: string;
        issueTypes: Array<{ id: string; name: string; description: string; subtask: any }>;
        adminsURL: string;
        isIgnore: boolean;
        style: string;
    }> {
        const projectBody = await this.request(this.getUrl('project', keyOrId));
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
    async isJiraPartExists(keyOrId: string): Promise<boolean> {
        const projectKey = utils.getProjectKeyFromIssueKey(keyOrId);
        try {
            await this.getProject(projectKey);
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Make GET request to jira by projectID
     */
    async getProjectWithAdmins(projectKey: string): Promise<Project> {
        const projectBody = await this.getProject(projectKey);
        const { adminsURL } = projectBody;

        try {
            const { actors } = await this.request(adminsURL);
            const admins = actors.map(item => utils.extractName(item));

            return { ...projectBody, admins };
        } catch (err) {
            logger.warn('Not admins from request', err);

            return projectBody;
        }
    }

    /**
     * Make request to jira by issueID adding renderedFields
     */
    async getIssueFormatted(issueID: string): Promise<RenderedIssue> {
        try {
            const result = await this.getIssue(issueID, this.expandParams);

            return result;
        } catch (err) {
            throw ['getIssueFormatted Error', err].join('\n');
        }
    }

    /**
     * Make request to jira by issueID adding renderedFields and filter by fields
     */
    async getRenderedValues(key: string, fields: string[]): Promise<any> {
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
     */
    async searchUser(partName: string): Promise<object[]> {
        if (!partName) {
            return [];
        }
        const queryPararms = querystring.stringify({ query: partName });
        const url = this.getUrl('user', `search?${queryPararms}`);
        const allUsers = await this.request(url);

        return allUsers.filter(user => this.checkUser(user.displayName, partName));
    }

    /**
     * Add watcher to issue
     */
    async addWatcher(accountId: string, keyOrId: string) {
        const watchersUrl = this.getUrl('issue', keyOrId, 'watchers');

        await this.requestPost(watchersUrl, schemas.watcher(accountId));
    }

    /**
     * Add assign to issue
     */
    async addAssignee(accountId: string, keyOrId: string) {
        const assigneeUrl = this.getUrl('issue', keyOrId, 'assignee');

        await this.requestPut(assigneeUrl, schemas.assignee(accountId));
    }

    /**
     * Get issue without throw on error
     */
    async getIssueSafety(keyOrId: string): Promise<Issue | false> {
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
     */
    async hasIssue(keyOrId: string): Promise<boolean> {
        const res = await this.getIssueSafety(keyOrId);

        return Boolean(res);
    }

    /**
     * Get status data with color
     */
    async getStatusData(statusId: string): Promise<object> {
        try {
            const statusUrl = this.getUrl('status', statusId);

            const data = await this.request(statusUrl);

            return { colorName: R.path(['statusCategory', 'colorName'], data) };
        } catch (error) {
            logger.error(error);

            return {};
        }
    }

    /**
     * Get last created issue key in project
     */
    async getLastIssueKey(projectKey: string): Promise<string | undefined> {
        try {
            const searchUrl = this.getUrl('search');

            const data = await this.request(searchUrl, {
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
     */
    async hasStatusInProject(projectKey: string, status: string): Promise<boolean> {
        const issuKey = await this.getLastIssueKey(projectKey);
        if (issuKey) {
            const transitions = await this.getPossibleIssueStatuses(issuKey);

            return transitions.some(el => el.to.name === status);
        }

        return false;
    }

    /**
     * Get issue current status
     */
    async getCurrentStatus(keyOrId: string): Promise<string | undefined> {
        const issue = await this.getIssueSafety(keyOrId);

        return R.path(['fields', 'status', 'name'], issue);
    }
}
