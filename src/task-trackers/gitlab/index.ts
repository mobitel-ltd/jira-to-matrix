import axios, { AxiosRequestConfig } from 'axios';
import querystring from 'querystring';
import { TaskTracker, Parser, Issue, Project, Config, IssueWithComments } from '../../types';
import { TIMEOUT } from '../../lib/consts';
import * as messages from '../../lib/messages';
import { getLogger } from '../../modules/log';
import { GitlabIssue, GitlabProject, GitlabUserData, Notes, GitlabSelectors } from './types';
import { GitlabParser } from './parser.gtilab';
import { selectors } from './selectors';

const logger = getLogger(module);

export class Gitlab implements TaskTracker {
    // export class Gitlab {
    url: string;
    user: string;
    password: string;
    inviteIgnoreUsers: string[];
    restVersion = 'api/v4';
    pingInterval: number;
    pingCount: number;
    expandParams: { expand: string };
    public selectors: GitlabSelectors;
    public parser: Parser;

    constructor(options: {
        url: string;
        user: string;
        inviteIgnoreUsers?: string[];
        password: string;
        features: Config['features'];
        interval?: number;
        count?: number;
    }) {
        this.url = options.url;
        this.user = options.user;
        this.password = options.password;
        this.inviteIgnoreUsers = options.inviteIgnoreUsers || [];
        this.pingInterval = options.interval || 500;
        this.pingCount = options.count || 10;
        this.selectors = selectors;
        this.parser = new GitlabParser(options.features, selectors);
    }

    async request(url: string, newOptions?: AxiosRequestConfig): Promise<any> {
        const options: AxiosRequestConfig = {
            method: 'GET',
            headers: { 'private-token': this.password, 'content-type': 'application/json' },
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

    requestPost(url: string, options: AxiosRequestConfig): Promise<any> {
        const _options: AxiosRequestConfig = {
            ...options,
            method: 'POST',
        };

        return this.request(url, _options);
    }

    /**
     * @example namespace/project-123
     */
    transformFromKey(key: string): { namespaceWithProject: string; issueId: number } {
        const [issueId, ...keyReversedParts] = key
            .toLowerCase()
            .split('-')
            .reverse();
        const namespaceWithProject = keyReversedParts.reverse().join('-');

        return { namespaceWithProject, issueId: Number(issueId) };
    }

    transformToKey(namespaceWithProject: string, issueId: number): string {
        return [namespaceWithProject, issueId].join('-');
    }

    private async getProjectIdByNamespace(namespaceWithProjectName: string): Promise<number> {
        const project = await this.getBaseProject(namespaceWithProjectName);

        return project.id as number;
    }

    // key is like namespace/project-123
    async getIssue(key: string): Promise<Issue & GitlabIssue> {
        const { namespaceWithProject, issueId } = this.transformFromKey(key);
        const projectId = await this.getProjectIdByNamespace(namespaceWithProject);

        const url = this.getRestUrl('projects', projectId, 'issues', issueId);
        const issue: GitlabIssue = await this.request(url);

        return { ...issue, key };
    }

    getRestUrl(...args: (string | number)[]) {
        return [this.url, this.restVersion, ...args].join('/');
    }

    getPostCommentBody(sender: string, bodyText: string): string {
        // TODO fix bug in view
        return `@${sender}:<br>${bodyText}`;
    }

    async postComment(gitlabIssueKey: string, sender: string, bodyText: string): Promise<string> {
        const { namespaceWithProject, issueId } = this.transformFromKey(gitlabIssueKey);
        const projectId = await this.getProjectIdByNamespace(namespaceWithProject);

        const body = this.getPostCommentBody(sender, bodyText);
        const params = querystring.stringify({ body });
        // TODO make correct query params passing
        const url = this.getRestUrl('projects', projectId, 'issues', issueId, 'notes?' + params);

        await this.requestPost(url, {});

        return body;
    }

    async getIssueSafety(key: string): Promise<Issue | boolean> {
        try {
            const issue = await this.getIssue(key);

            return issue;
        } catch (error) {
            logger.warn(error);

            return false;
        }
    }

    private async getBaseProject(namespaceWithProjectName: string): Promise<GitlabProject> {
        const queryPararms = querystring.stringify({ search: namespaceWithProjectName });
        // TODO make correct query params passing
        const url = this.getRestUrl('projects?' + queryPararms);
        const [project] = await this.request(url);
        if (!project) {
            throw new Error(`Not found project by namespace ${namespaceWithProjectName}`);
        }

        return project;
    }

    private async getProjectMembers(projectId): Promise<GitlabUserData[]> {
        const url = this.getRestUrl('projects', projectId, 'members', 'all');

        return await this.request(url);
    }

    async getProjectLead(projectId): Promise<GitlabUserData> {
        const projectMembers = await this.getProjectMembers(projectId);

        return projectMembers.reduce((acc, val) => (acc.access_level > val.access_level ? acc : val));
    }

    private parseProject(project: GitlabProject & { lead: string }): Project {
        return project;
    }

    async getProject(namespaceWithProjectName: string): Promise<Project> {
        const project = await this.getBaseProject(namespaceWithProjectName);
        const projectLead = await this.getProjectLead(project.id);

        return this.parseProject({ ...project, lead: projectLead.name });
    }

    async getIssueWatchers(key): Promise<string[]> {
        const issue = await this.getIssue(key);
        const members = [issue.assignee, issue.author];

        return members.filter(Boolean).map(el => el!.name);
    }

    getViewUrl(key: string) {
        const keyData = this.transformFromKey(key);

        return [this.url, keyData.namespaceWithProject, 'issues', keyData.issueId].join('/');
    }

    async getIssueComments(key): Promise<IssueWithComments> {
        const { namespaceWithProject, issueId } = this.transformFromKey(key);
        const projectId = await this.getProjectIdByNamespace(namespaceWithProject);

        const url = this.getRestUrl('projects', projectId, 'issues', issueId, 'notes');

        const commentsBody: Notes[] = await this.request(url);
        const comments = commentsBody.map(el => ({ id: el.id, body: el.body }));

        return {
            key,
            comments,
        };
    }

    testJiraRequest() {
        return Promise.resolve();
    }

    async hasIssue(key) {
        const res = await this.getIssueSafety(key);

        return Boolean(res);
    }

    checkIgnoreList(ignoreList, taskType): boolean {
        return ignoreList.includes(taskType);
    }

    getKeyOrIdForCheckIgnore(body): string {
        return this.selectors.getIssueKey(body) || this.selectors.getIssueId(body);
    }

    isIgnoreHook(body) {
        return this.selectors.isIgnoreHookType(body);
    }

    isAvoidHookType() {
        return false;
    }
}
