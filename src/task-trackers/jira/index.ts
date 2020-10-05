import axios, { AxiosRequestConfig } from 'axios';
import querystring from 'querystring';
import * as R from 'ramda';
import { getLogger } from '../../modules/log';
import * as messages from '../../lib/messages';
import { schemas } from './schemas';
import delay from 'delay';
import { Issue, Transition, Config, IssueWithComments } from '../../types/index';
import { TIMEOUT } from '../../lib/consts';
import { selectors } from './selector.jira';
import { TaskTracker } from '../../types';
import { getProjectKeyFromIssueKey, errorTracing } from '../../lib/utils';
import { JiraSelectors, JiraProject, RenderedIssue } from './types';
import { JiraParser } from './parser.jira';

const logger = getLogger(module);

/**
 * @typedef Issue
 * @property {string} id issue id
 * @property {string} key issue key
 */

enum IssueType {
    issue = 'issue',
    comment = 'comment',
    project = 'project',
    issuelink = 'issuelink',
}

export class Jira implements TaskTracker {
    url: string;
    user: string;
    password: string;
    inviteIgnoreUsers: string[];
    restVersion = 'rest/api/2';
    pingInterval: number;
    pingCount: number;
    expandParams: { expand: string };
    public selectors: JiraSelectors;
    public parser: JiraParser;

    constructor(
        private options: {
            url: string;
            user: string;
            inviteIgnoreUsers: string[];
            password: string;
            interval: number;
            count: number;
            features: Config['features'];
        },
    ) {
        this.url = options.url;
        this.user = options.user;
        this.password = options.password;
        this.inviteIgnoreUsers = options.inviteIgnoreUsers || [];
        this.pingInterval = options.interval || 500;
        this.pingCount = options.count || 10;
        this.expandParams = { expand: 'renderedFields' };
        this.selectors = selectors;
        this.parser = new JiraParser(options.features, selectors);
    }

    static expandParams = { expand: 'renderedFields' };

    init(): Jira {
        return new Jira(this.options);
    }

    getMilestoneWatchers = () => [] as any;

    getMilestoneUrl = () => undefined;

    /**
     * Create jira url
     */
    getUrl(...args: any[]): string {
        return [this.url, this.restVersion, ...args].join('/');
    }

    get token(): string {
        const encoded = Buffer.from(`${this.user}:${this.password}`).toString('base64');

        return `Basic ${encoded}`;
    }

    async request(url: string, newOptions?: AxiosRequestConfig): Promise<any> {
        const options: AxiosRequestConfig = {
            method: 'GET',
            headers: { Authorization: this.token, 'content-type': 'application/json' },
            timeout: TIMEOUT,
            ...newOptions,
            url,
        };
        try {
            const response = await axios(options);
            logger.debug(`${options.method} request to jira with Url ${url} suceeded`);

            return response.data;
        } catch (err) {
            throw messages.getRequestErrorLog(url, err?.response?.status, options.method, err?.response?.statusText);
        }
    }

    /**
     * POST request
     */
    requestPost(url: string, data: string): Promise<any> {
        return this.request(url, { method: 'POST', data });
    }

    /**
     * PUT request
     */
    requestPut(url: string, data: string): Promise<any> {
        return this.request(url, { method: 'PUT', data });
    }

    /**
     * Check if user can be invited
     *
     * @param  {string} name user name
     * @returns {boolean} true if can be invite
     */
    _isExpectedToInvite(name: string): boolean {
        return Boolean(name && !this.inviteIgnoreUsers.includes(name));
    }

    /**
     * Check if user display name includes name part
     */
    checkUser(displayName: string, expectedName: string): boolean {
        return displayName.toLowerCase().includes(expectedName.toLowerCase());
    }

    async sendMessage(keyOrId: string, bodyText: string): Promise<void> {
        const url = this.getUrl('issue', keyOrId, 'comment');

        await this.requestPost(url, schemas.info(bodyText));
    }

    createLink(urlRoom: string, body: string): string {
        return `[${body}|${urlRoom}]`;
    }

    /**
     * Post comment to issue
     */
    async postComment(keyOrId: string, { senderDisplayName }, bodyText: string): Promise<void> {
        const url = this.getUrl('issue', keyOrId, 'comment');

        await this.requestPost(url, schemas.comment(senderDisplayName, bodyText));
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
    async getIssueWatchers(keyOrId: string): Promise<{ displayName: string }[]> {
        const url = this.getUrl('issue', keyOrId, 'watchers');
        const body = await this.request(url);
        const watchers =
            body && Array.isArray(body.watchers) ? body.watchers.map(item => this.selectors.extractName(item)) : [];

        const issue = await this.getIssue(keyOrId);
        const roomMembers = this.selectors.getIssueMembers(issue);

        const allWatchersSet: Set<string> = new Set([...roomMembers, ...watchers]);

        return [...allWatchersSet]
            .filter(Boolean)
            .filter(user => this._isExpectedToInvite(user))
            .filter(user => !user.includes(this.user))
            .map(displayName => ({ displayName }));
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
     * Make GET request to jira by issueId and params
     */
    async getIssue(keyOrId: string): Promise<Issue> {
        try {
            const url = this.getUrl('issue', keyOrId);
            const issue = await this.request(url);

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
        const projectKey = getProjectKeyFromIssueKey(keyOrId);
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
    async getProjectWithAdmins(projectKey: string): Promise<JiraProject> {
        const projectBody = await this.getProject(projectKey);
        const { adminsURL } = projectBody;

        try {
            const { actors } = await this.request(adminsURL);
            const admins = actors.map(item => this.selectors.extractName(item));

            return { ...projectBody, admins };
        } catch (err) {
            logger.warn('Not admins from request', err);

            return projectBody;
        }
    }

    async getIssueComments(issueKeyOrId): Promise<IssueWithComments> {
        const issue = await this.getIssueFormatted(issueKeyOrId);

        const comments = issue.renderedFields.comment.comments.map(el => ({ id: el.id, body: el.body }));

        return { comments, key: issue.key };
    }

    /**
     * Make request to jira by issueId adding renderedFields
     */
    async getIssueFormatted(keyOrId: string): Promise<RenderedIssue> {
        try {
            const url = this.getUrl('issue', keyOrId);
            const issue = await this.request(url, { params: this.expandParams });

            return issue;
        } catch (err) {
            throw ['getIssueFormatted Error', err].join('\n');
        }
    }

    /**
     * Make request to jira by issueId adding renderedFields and filter by fields
     */
    async getIssueFieldsValues(key: string, fields: string[]): Promise<any> {
        try {
            const issue = await this.getIssueFormatted(key);

            const renderedValues = R.pipe(
                R.pick(fields),
                R.filter(value => !!value),
            )(issue.renderedFields);

            return renderedValues;
        } catch (err) {
            throw ['getIssueFieldsValues error', err].join('\n');
        }
    }

    /**
     * Get user list by part of the name
     */
    async searchUser(partName: string): Promise<{ displayName: string; accountId: string }[]> {
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
    async getStatusColor({ statusId }: { statusId: string | number }): Promise<string | undefined> {
        try {
            const statusUrl = this.getUrl('status', statusId);

            const data = await this.request(statusUrl);

            const colorName: string | undefined = R.path(['statusCategory', 'colorName'], data);

            return colorName;
        } catch (error) {
            logger.error(error);
        }
    }

    /**
     * Get last created issue key in project
     */
    async getLastIssueKey(projectKey: string): Promise<string | undefined> {
        try {
            const searchUrl = this.getUrl('search');

            const data = await this.request(searchUrl, {
                params: {
                    jql: `project=${projectKey}`,
                },
            });

            return R.path(['issues', '0', 'key'], data);
        } catch (error) {
            const msg = errorTracing(`Not found or not available project ${projectKey}`, error);
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

    getRestUrl(...args) {
        return [this.url, this.restVersion, ...args].join('/');
    }

    getViewUrl(key, type = 'browse') {
        return [this.url, type, key].join('/');
    }

    getHookHandler(type: IssueType) {
        const handlers = {
            issue: async body => {
                const key = this.selectors.getIssueKey(body)!;
                const status = await this.getIssueSafety(key);

                return !status || !!this.selectors.getChangelogField('Rank', body);
            },
            issuelink: async body => {
                const allId = [
                    this.selectors.getIssueLinkSourceId(body),
                    this.selectors.getIssueLinkDestinationId(body),
                ];
                const issues = await Promise.all(allId.map(id => this.getIssueSafety(id as string)));

                return !issues.some(Boolean);
            },
            project: async body => {
                const key = this.selectors.getProjectKey(body)!;
                const { isIgnore } = await this.getProject(key);
                return isIgnore;
            },
            comment: async body => {
                const id = this.selectors.getIssueId(body)!;
                const status = await this.getIssueSafety(id);

                return !status;
            },
        };

        return handlers[type];
    }

    async isIgnoreHook(body) {
        const type = this.selectors.getHookType(body);
        const handler = this.getHookHandler(type as IssueType);
        if (!handler) {
            logger.warn('Unknown hook type, should be ignored!');
            return true;
        }
        const status = await handler(body);

        if (status) {
            logger.warn('Project should be ignore');
        }

        return status;
    }

    isAvoidHookType(type: string) {
        return type === 'project';
    }

    async getAvailableIssueId(body): Promise<string> {
        const sourceId = this.selectors.getIssueLinkSourceId(body);
        const issue = sourceId && (await this.getIssueSafety(sourceId));

        return (issue ? sourceId : this.selectors.getIssueLinkDestinationId(body)) as string;
    }

    checkIgnoreList(ignoreList, taskType, hookType, body): boolean {
        if (hookType === 'issuelink' && ignoreList.includes('Sub-task')) {
            const nameTypeIssueLink = this.selectors.getNameIssueLinkType(body);
            return nameTypeIssueLink === 'jira_subtask_link';
        }

        return ignoreList.includes(taskType);
    }

    async getKeyOrIdForCheckIgnore(body): Promise<string> {
        const type = this.selectors.getHookType(body);

        return type === 'issuelink'
            ? await this.getAvailableIssueId(body)
            : this.selectors.getIssueKey(body) || this.selectors.getIssueId(body);
    }

    async getCurrentIssueColor(key: string): Promise<string> {
        const issue = await this.getIssue(key);

        return this.selectors.getIssueColor(issue);
    }
}
