import { setupCache } from 'axios-cache-adapter';
import { Projects } from '@gitbeaker/node';
import * as R from 'ramda';
import axios, { AxiosRequestConfig, AxiosInstance } from 'axios';
import querystring from 'querystring';
import { TaskTracker, Issue, Project, Config, IssueWithComments, DefaultLabel } from '../../types';
import { TIMEOUT } from '../../lib/consts';
import * as messages from '../../lib/messages';
import { getLogger } from '../../modules/log';
import {
    GitlabIssue,
    GitlabProject,
    GitlabUserData,
    Notes,
    GitlabSelectors,
    GitlabIssueHook,
    HookUser,
    GitlabLabel,
    HookTypes,
    GitlabLabelHook,
    Milestone,
    Colors,
    Groups,
    GitlabUserDataShort,
} from './types';
import { GitlabParser } from './parser.gtilab';
import { selectors } from './selectors';
import { DateTime } from 'luxon';

const logger = getLogger(module);

export class Gitlab implements TaskTracker {
    private slashCommandsList = [
        '/approve',
        '/assign',
        '/assign',
        '/assign',
        '/award',
        '/child_epic',
        '/clear_weight',
        '/close',
        '/confidential',
        '/copy_metadata',
        '/copy_metadata',
        '/create_merge_request',
        '/done',
        '/due',
        '/duplicate',
        '/epic',
        '/estimate',
        '/iteration',
        '/label',
        '/lock',
        '/merge',
        '/milestone',
        '/move',
        '/parent_epic',
        '/promote',
        '/publish',
        '/reassign',
        '/relabel',
        '/relate',
        '/remove_child_epic',
        '/remove_due_date',
        '/remove_epic',
        '/remove_estimate',
        '/remove_iteration',
        '/remove_milestone',
        '/remove_parent_epic',
        '/remove_time_spent',
        '/remove_zoom',
        '/reopen',
        '/shrug',
        '/spend',
        '/spend',
        '/submit_review',
        '/subscribe',
        '/tableflip',
        '/target_branch',
        '/title',
        '/todo',
        '/unassign',
        '/unassign',
        '/unlabel',
        '/unlock',
        '/unsubscribe',
        '/weight',
        '/wip',
        '/zoom',
    ];
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
    public parser: GitlabParser;
    milestone: Milestone;
    api: AxiosInstance;
    defaultLabel?: DefaultLabel;

    constructor(
        private options: {
            url: string;
            user: string;
            inviteIgnoreUsers?: string[];
            password: string;
            features: Config['features'];
            interval?: number;
            count?: number;
            defaultLabel?: DefaultLabel;
        },
    ) {
        this.url = options.url;
        this.user = options.user;
        this.password = options.password;
        this.inviteIgnoreUsers = options.inviteIgnoreUsers || [];
        this.pingInterval = options.interval || 500;
        this.pingCount = options.count || 10;
        this.selectors = selectors;
        this.parser = new GitlabParser(options.features, selectors);
        this.defaultLabel = options.defaultLabel;
        const cache = setupCache({
            maxAge: 5 * 1000,
        });
        this.api = axios.create({
            adapter: cache.adapter,
        });
    }

    init() {
        return new Gitlab(this.options);
    }

    async request(url: string, newOptions?: AxiosRequestConfig, contentType = 'application/json'): Promise<any> {
        const options: AxiosRequestConfig = {
            method: 'GET',
            headers: { 'private-token': this.password, 'content-type': contentType },
            timeout: TIMEOUT,
            ...newOptions,
            url,
        };
        try {
            const response = await this.api(options);
            logger.debug(`${options.method} request to gitlab with Url ${url} suceeded`);

            return response.data;
        } catch (err) {
            // TODO remove it
            // logger.error(err);
            throw messages.getRequestErrorLog(url, err?.response?.status, options.method, err?.response?.statusText);
        }
    }

    getMilestoneColors(milestone: Milestone): string[] {
        if (!milestone.due_date || !milestone.start_date) {
            return [Colors.gray];
        }
        if (milestone.state === 'closed') {
            return [Colors.gray];
        }
        const currentDate = DateTime.local();
        const startDate = DateTime.fromISO(milestone.start_date!);
        const endDate = DateTime.fromISO(milestone.due_date!);

        // https://stackoverflow.com/questions/60058489/compare-only-dates-with-luxon-datetime
        if (startDate.startOf('day') > currentDate.startOf('day')) {
            return [Colors.yellow];
        }

        if (currentDate.startOf('day') > endDate.startOf('day')) {
            return [Colors.gray];
        }

        const allDays = endDate.diff(startDate, ['days']).days + 1;
        const grayDays = Math.floor(currentDate.diff(startDate, ['days']).days);
        const futureDays = allDays - grayDays;

        return [...Array(grayDays).fill(Colors.gray), ...Array(futureDays).fill(Colors.green)];
    }

    getMilestoneUrl(body: GitlabIssue): string | undefined {
        const milestone = body.milestone;
        if (milestone) {
            if (milestone.project_id) {
                return this.getRestUrl('projects', milestone.project_id, 'milestones', milestone.id, 'issues');
            }
            if (milestone.group_id) {
                return this.getRestUrl('groups', milestone.group_id, 'milestones', milestone.id, 'issues');
            }
        }
    }

    // async getLabels();

    getStatusColor({
        issueKey,
        hookLabels = [],
    }: {
        issueKey: string;
        hookLabels?: GitlabLabelHook[];
    }): Promise<string[]> {
        return this.getCurrentIssueColor(issueKey, hookLabels);
    }

    requestPost(url: string, options: AxiosRequestConfig, contentType?: string): Promise<any> {
        const _options: AxiosRequestConfig = {
            ...options,
            method: 'POST',
        };

        return this.request(url, _options, contentType);
    }

    requestPut(url: string, options: AxiosRequestConfig, contentType?: string): Promise<any> {
        const _options: AxiosRequestConfig = {
            ...options,
            method: 'PUT',
        };

        return this.request(url, _options, contentType);
    }

    private async getProjectIdByNamespace(namespaceWithProjectName: string): Promise<number> {
        const project = await this.getBaseProject(namespaceWithProjectName);

        return project.id as number;
    }

    private async getGroupIdByNamespace(namespaceWithProjectName: string): Promise<number | undefined> {
        const [groupName] = namespaceWithProjectName.split('/');
        const groupUrl = this.getRestUrl(`groups?search=${groupName}`);
        const groups: Groups[] = await this.request(groupUrl);

        const group = groups.find(el => el.path === groupName);

        return group?.id;
    }

    // key is like namespace/project-123
    async getIssue(key: string): Promise<Issue & GitlabIssue> {
        const { namespaceWithProject, issueId } = this.selectors.transformFromIssueKey(key);
        const projectId = await this.getProjectIdByNamespace(namespaceWithProject);

        const url = this.getRestUrl('projects', projectId, 'issues', issueId);
        const issue: GitlabIssue = await this.request(url);

        return { ...issue, key };
    }

    async getMilestoneIssues(url: string): Promise<Array<GitlabIssue>> {
        const issues: GitlabIssue[] = await this.request(url);

        return issues;
    }

    async getMilestoneWatchers(url: string): Promise<string[]> {
        const issues = await this.getMilestoneIssues(url);
        const milestoneMembers = issues.map(el => this.selectors.getAssigneeDisplayName(el)).flat();

        return R.uniq(milestoneMembers);
    }

    getRestUrl(...args: (string | number)[]) {
        return [this.url, this.restVersion, ...args].join('/');
    }

    private isSlashCommand(text: string): boolean {
        const [firstWord] = text.split(' ');

        return this.slashCommandsList.includes(firstWord);
    }

    getPostCommentBody(sender: string, bodyText: string): string {
        if (this.isSlashCommand(bodyText)) {
            logger.debug(`Sended text "${bodyText}" is gitlab slash command`);
            return bodyText;
        }

        return `@${sender}:\n${bodyText}`;
    }

    async getIssueFieldsValues(key: string, fields: (keyof GitlabIssueHook['changes'])[]): Promise<any> {
        try {
            const issue = await this.getIssue(key);

            const renderedValues = R.pipe(
                R.pick(fields),
                R.filter(value => !!value),
                R.toPairs,
                R.map(([key, value]) => {
                    switch (key) {
                        case 'assignees':
                            return { [key]: (value as HookUser)[0].name };
                        case 'labels':
                            return { [key]: (value as string)[0] };
                        default:
                            return { [key]: value };
                    }
                }),
            )(issue);

            return renderedValues;
        } catch (err) {
            throw ['getIssueFieldsValues error', err].join('\n');
        }
    }

    private isBadRequest(errMessage: string): boolean {
        const badRequestErrorPart = 'status is 400';

        return errMessage.includes(badRequestErrorPart);
    }

    createLink(urlRoom: string, body: string): string {
        return `[${body}](${urlRoom})`;
    }

    async postComment(gitlabIssueKey: string, { sender }, bodyText: string): Promise<string> {
        const body = this.getPostCommentBody(sender, bodyText);

        return await this.sendMessage(gitlabIssueKey, body);
    }

    async sendMessage(gitlabIssueKey: string, body: string): Promise<string> {
        const { namespaceWithProject, issueId } = this.selectors.transformFromIssueKey(gitlabIssueKey);
        const params = querystring.stringify({ body });
        const projectId = await this.getProjectIdByNamespace(namespaceWithProject);
        // TODO make correct query params passing
        const url = this.getRestUrl('projects', projectId, 'issues', issueId, 'notes');

        try {
            await this.requestPost(url, { data: params }, 'application/x-www-form-urlencoded');

            return body;
        } catch (error) {
            if (typeof error === 'string' && this.isBadRequest(error)) {
                // https://gitlab.com/gitlab-org/gitlab/-/issues/35627
                logger.warn('Post command has got 400 status, but it will be skipped because of gitlab bug');
                return body;
            }

            throw error;
        }
    }

    async getIssueSafety(key: string): Promise<Issue | false> {
        try {
            const issue = await this.getIssue(key);

            return issue;
        } catch (error) {
            logger.warn(error);

            return false;
        }
    }

    private async getBaseProject(namespaceWithProjectName: string): Promise<GitlabProject> {
        const queryPararms = namespaceWithProjectName.split('/').join('%2F');
        // TODO make correct query params passing
        const url = this.getRestUrl('projects/' + queryPararms);
        const foundProjects: GitlabProject = await this.request(url);
        const project: boolean = foundProjects.path_with_namespace === namespaceWithProjectName;
        if (!project) {
            throw new Error(`Not found project by namespace ${namespaceWithProjectName}`);
        }

        return foundProjects;
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

    async getIssueWatchers(key): Promise<{ userId: string; displayName: string }[]> {
        const issue = await this.getIssue(key);
        const members = [issue.assignee, issue.author];

        return members
            .filter((el): el is GitlabUserDataShort => Boolean(el))
            .map(el => ({
                displayName: el.name,
                userId: el.username,
            }));
    }

    // TODO fix for projects
    getViewUrl(key: string) {
        const keyData = this.selectors.transformFromKey(key);

        return keyData.issueId
            ? [this.url, keyData.namespaceWithProject, 'issues', keyData.issueId].join('/')
            : [this.url, keyData.namespaceWithProject, 'milestones', keyData.milestoneId].join('/');
    }

    async getIssueComments(key): Promise<IssueWithComments> {
        const { namespaceWithProject, issueId } = this.selectors.transformFromIssueKey(key);
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

    getKeyOrIdForCheckIgnore(body): string[] | string {
        return this.selectors.keysForCheckIgnore(body);
    }

    isIgnoreHook(body) {
        return this.selectors.isIgnoreHookType(body);
    }

    isAvoidHookType(type) {
        return type === HookTypes.Push;
    }

    async upload(
        issueKey: string,
        fileOptions: { url: string; fileName: string },
    ): Promise<{ fullUrl: string; markdown: string }> {
        const response = await axios.get(fileOptions.url, { responseType: 'arraybuffer' });
        const imageType = response.headers['content-type'];
        const { namespaceWithProject } = this.selectors.transformFromIssueKey(issueKey);
        const projectId = await this.getProjectIdByNamespace(namespaceWithProject);

        const projects = new Projects({ token: this.password, host: this.url });
        const uploadInfo: any = await projects.upload(projectId, response.data, {
            metadata: { contentType: imageType, filename: fileOptions.fileName },
        });

        const fullUrl = this.getRestUrl('projects', projectId) + uploadInfo.url;

        return {
            fullUrl,
            markdown: uploadInfo.markdown,
        };
    }

    async getProjectLabels(namespaceWithProject: string): Promise<GitlabLabel[]> {
        const projectId = await this.getProjectIdByNamespace(namespaceWithProject);
        const url = this.getRestUrl('projects', projectId, 'labels?per_page=100');

        return await this.request(url);
    }

    async getGroupLabels(namespaceWithProject: string): Promise<GitlabLabel[]> {
        const groupId = await this.getGroupIdByNamespace(namespaceWithProject);
        if (!groupId) {
            logger.warn(
                `Group by id with namespace ${namespaceWithProject} is not found. Return empty array of labels`,
            );

            return [];
        }
        const url = this.getRestUrl('groups', groupId, 'labels?per_page=100');

        return await this.request(url);
    }

    async getAllAvailalbleLabels(namespaceWithProject): Promise<GitlabLabel[]> {
        const projectLabels = await this.getProjectLabels(namespaceWithProject);
        const groupLabels = await this.getGroupLabels(namespaceWithProject);

        return [...projectLabels, ...groupLabels];
    }

    async setDefaultLabelForIssue(gitlabIssueKey: string, labelName: string): Promise<string> {
        const { namespaceWithProject, issueId } = this.selectors.transformFromIssueKey(gitlabIssueKey);
        const params = querystring.stringify({ labels: labelName });
        const projectId = await this.getProjectIdByNamespace(namespaceWithProject);

        // TODO make correct query params passing
        const url = this.getRestUrl('projects', projectId, 'issues', `${issueId}?${params}`);

        try {
            await this.requestPut(url, {});

            return labelName;
        } catch (error) {
            if (typeof error === 'string' && this.isBadRequest(error)) {
                // https://gitlab.com/gitlab-org/gitlab/-/issues/35627
                logger.warn('Post command has got 400 status, but it will be skipped because of gitlab bug');
                return labelName;
            }

            throw error;
        }
    }

    async createDefaultLabelInGroup(groupId: number): Promise<string | undefined> {
        if (!this.defaultLabel) {
            return;
        }
        // TODO make correct query params passing
        const url = this.getRestUrl('groups', groupId, 'labels');

        try {
            const data = await this.requestPost(url, { data: this.defaultLabel });
            return data;
        } catch (error) {
            throw error;
        }
    }

    async getLabelColorInGroup(namespaceWithProject: string, labelName: string): Promise<string | undefined> {
        const groupLabels = await this.getGroupLabels(namespaceWithProject);
        const labelData = groupLabels.find(el => el.name === labelName);

        return labelData?.color;
    }

    async getCurrentIssueColor(key: string, hookLabels?: GitlabLabelHook[]): Promise<string[]> {
        const issue = await this.getIssue(key);
        if (issue.state === 'closed') {
            return [Colors.gray];
        }

        const { namespaceWithProject } = this.selectors.transformFromIssueKey(key);
        if (!hookLabels) {
            const labels = await this.getAllAvailalbleLabels(namespaceWithProject);
            const colors = labels.filter(label => issue.labels?.includes(label.name)).map(label => label.color);

            return [...new Set(colors)];
        }
        if (hookLabels.length == 0) {
            if (this.defaultLabel) {
                const labelColor = await this.getLabelColorInGroup(namespaceWithProject, this.defaultLabel.name);

                if (labelColor) {
                    await this.setDefaultLabelForIssue(key, this.defaultLabel.name);

                    return [labelColor];
                }
            }
        }

        const colors = hookLabels.map(label => label.color).sort();

        return [...new Set(colors)];
    }
}
