import { GitlabIssueHook, GitlabCommentHook, HookTypes, GitlabSelectors, GitlabIssue } from './types';
import { translate } from '../../locales';

const transformToKey = (namespaceWithProject: string, issueId: number) => [namespaceWithProject, issueId].join('-');

const handlers = {
    issue: {
        getProjectKey: (body: GitlabIssueHook) => body.project.path_with_namespace,
        getFullKey: (body: GitlabIssueHook) =>
            transformToKey(body.project.path_with_namespace, body.object_attributes.id),
        getDisplayName: (body: GitlabIssueHook) => body.user.name,
        getIssueId: (body: GitlabIssueHook) => body.object_attributes.id,
        getIssueName: (body: GitlabIssueHook) => body.object_attributes.title,
        getSummary: (body: GitlabIssueHook) => body.object_attributes.description,
    },
    note: {
        getFullKey: (body: GitlabCommentHook) =>
            transformToKey(body.project.path_with_namespace, body.object_attributes.id),
        getProjectKey: (body: GitlabCommentHook) => body.project.path_with_namespace,
        getDisplayName: (body: GitlabCommentHook) => body.user.name,
        getCommentBody: (body: GitlabCommentHook) => ({
            id: body.object_attributes.id,
            body: body.object_attributes.note,
        }),
        getIssueId: (body: GitlabCommentHook) => body.issue.id,
        getIssueName: (body: GitlabCommentHook) => body.issue.title,
        getSummary: (body: GitlabCommentHook) => body.issue.description,
    },
};

const issueRequestHandlers = {
    getMembers: (body: GitlabIssue) => [body.author.username, body.assignee.username],
    getDisplayName: (body: GitlabIssue) => body.author.name,
    getIssueId: (body: GitlabIssue) => body.id,
    getProjectKey: (body: GitlabIssue): string => {
        const [projectKey] = body.references.full.split('#');

        return projectKey;
    },
    getFullKey: (body: GitlabIssue) => transformToKey(issueRequestHandlers.getProjectKey(body), body.id),
    getIssueName: (body: GitlabIssue) => body.title,
    getSummary: (body: GitlabIssue) => body.description,
};

const getBodyWebhookEvent = (body: any): string | undefined => body?.object_kind;

const getHandler = body => {
    const type = getBodyWebhookEvent(body);

    return type && handlers[type];
};

const runMethod = (body: any, method: string): any => {
    const handler = getHandler(body);

    return handler && handler[method] && handler[method](body);
};

const getHeaderText = body => {
    const name = handlers.note.getDisplayName(body);

    return translate('comment_created', { name });
};

const getIssueMembers = body => issueRequestHandlers.getMembers(body);

const getMembers = body => runMethod(body, 'getMembers') || getIssueMembers(body);

const isCommentEvent = body => getBodyWebhookEvent(body) === HookTypes.Comment;

const getTypeEvent = body => body?.event_type;

const getIssueCreator = (body: GitlabIssue) => body?.author?.name;

const getDisplayName = body => runMethod(body, 'getDisplayName');

const isCorrectWebhook = (body: any, hookName: any): boolean => getBodyWebhookEvent(body) === hookName;

const getProjectKey = body => runMethod(body, 'getProjectKey') || issueRequestHandlers.getProjectKey(body);

const getBodyTimestamp = body => {
    const createdAt = body?.object_attributes?.created_at;

    return new Date(createdAt).getTime();
};

const getRedisKey = (funcName: string, body: any): string => [funcName, getBodyTimestamp(body)].join('_');

const getIssueId = body => runMethod(body, 'getIssueId') || issueRequestHandlers.getIssueId(body);

const getIssueKey = body => runMethod(body, 'getFullKey') || issueRequestHandlers.getFullKey(body);

const getIssueName = body => runMethod(body, 'getIssueName') || issueRequestHandlers.getIssueName(body);

const getSummary = body => runMethod(body, 'getSummary') || issueRequestHandlers.getSummary(body);

export const selectors: GitlabSelectors = {
    transformToKey,
    getBodyTimestamp,
    getHeaderText,
    isCommentEvent,
    getBodyWebhookEvent,
    getTypeEvent,
    getIssueCreator,
    getDisplayName,
    getMembers,
    getIssueMembers,
    isCorrectWebhook,
    getCommentBody: handlers.note.getCommentBody,
    getProjectKey,
    getHookType: getBodyWebhookEvent,
    getRedisKey,
    getIssueId,
    getIssueKey,
    getKey: getIssueKey,
    getIssueName,
    getSummary,
};
