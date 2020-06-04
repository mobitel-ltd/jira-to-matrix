import { GitlabIssueHook, GitlabCommentHook, HookTypes, GitlabSelectors, GitlabIssue } from './types';
import { translate } from '../../locales';
import { DescriptionFields } from '../../types';

const transformToKey = (namespaceWithProject: string, issueId: number) => [namespaceWithProject, issueId].join('-');

interface BodyGetters<T> {
    getProjectKey(body: T): string;
    getFullKey(body: T): string;
    getDisplayName(body: T): string;
    getIssueId(body: T): number;
    getIssueName(body: T): string;
    getSummary(body: T): string;
    getMembers(body: T): string[];
    getDescriptionFields(body: T): DescriptionFields | undefined;
}

interface CommentGetters<T> extends BodyGetters<T> {
    getCommentBody(
        body: T,
    ): {
        id: number;
        body: string;
    };
}

const missField = translate('miss');

const handlers: { issue: BodyGetters<GitlabIssueHook>; note: CommentGetters<GitlabCommentHook> } = {
    issue: {
        getProjectKey: body => body.project.path_with_namespace,
        getFullKey: body => transformToKey(body.project.path_with_namespace, body.object_attributes.id),
        getDisplayName: body => body.user.name,
        getIssueId: body => body.object_attributes.id,
        getIssueName: body => body.object_attributes.title,
        getSummary: body => body.object_attributes.description,
        getMembers: body => [body.assignee.name, body.user.name],
        getDescriptionFields: body => ({
            assigneeName: handlers.issue.getDisplayName(body),
            description: handlers.issue.getSummary(body),
            epicLink: missField,
            estimateTime: missField,
            priority: missField,
            reporterName: missField,
            typeName: missField,
        }),
    },
    note: {
        getFullKey: body => transformToKey(body.project.path_with_namespace, body.issue.id),
        getProjectKey: body => body.project.path_with_namespace,
        getDisplayName: body => body.user.name,
        getCommentBody: body => ({
            id: body.object_attributes.id,
            body: body.object_attributes.note,
        }),
        getIssueId: body => body.issue.id,
        getIssueName: body => body.issue.title,
        getSummary: body => body.issue.description,
        // Return undefined because there is no way to get expected issue fields by comment hook
        getDescriptionFields: () => undefined,
        getMembers: body => [body.user.name],
    },
};

const issueRequestHandlers: BodyGetters<GitlabIssue> = {
    getMembers: body => [body.author.username, body.assignee.username],
    getDisplayName: body => body.author.name,
    getIssueId: body => body.id,
    getProjectKey: body => {
        const [projectKey] = body.references.full.split('#');

        return projectKey;
    },
    getFullKey: body => transformToKey(issueRequestHandlers.getProjectKey(body), body.id),
    getIssueName: body => body.title,
    getSummary: body => body.description,
    getDescriptionFields: body => ({
        assigneeName: issueRequestHandlers.getDisplayName(body),
        description: issueRequestHandlers.getSummary(body),
        epicLink: missField,
        estimateTime: missField,
        priority: missField,
        reporterName: missField,
        typeName: missField,
    }),
};

const getBodyWebhookEvent = (body: any): string | undefined => body?.object_kind;

const getHandler = (body): typeof issueRequestHandlers | typeof handlers.issue | typeof handlers.note | undefined => {
    const type = getBodyWebhookEvent(body);

    return (type && handlers[type]) || issueRequestHandlers;
};

const isIgnoreHookType = (body): boolean => {
    const type = getBodyWebhookEvent(body);

    return !Boolean(type && handlers[type]);
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

const getDescriptionFields = (body): DescriptionFields => runMethod(body, 'getDescriptionFields');

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
    getDescriptionFields,
    isIgnoreHookType,
};
