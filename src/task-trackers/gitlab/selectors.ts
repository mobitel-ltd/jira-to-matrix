import { differenceBy, union, groupBy, mapValues } from 'lodash';
import {
    GitlabIssueHook,
    GitlabCommentHook,
    HookTypes,
    GitlabSelectors,
    GitlabIssue,
    GitlabLabelHook,
    GitlabPushHook,
    GitlabPushCommit,
} from './types';
import marked from 'marked';
import { translate } from '../../locales';
import { DescriptionFields, IssueChanges, IssueStateEnum, CommitInfo } from '../../types';
import { URL } from 'url';

/**
 * @example namespace/project-123
 */
const transformFromKey = (key: string): { namespaceWithProject: string; issueId: number } => {
    const [issueId, ...keyReversedParts] = key
        .toLowerCase()
        .split('-')
        .reverse();
    const namespaceWithProject = keyReversedParts.reverse().join('-');

    return { namespaceWithProject, issueId: Number(issueId) };
};

export const transformToKey = (namespaceWithProject: string, issueId: number): string =>
    [namespaceWithProject, issueId].join('-');

interface BaseGetters<T> {
    getDisplayName(body: T): string;
    /**
     * ii_ivanov
     */
    getUserId(body: T): string;
    keysForCheckIgnore(body: T): string[] | string;
}

interface BodyGetters<T> extends BaseGetters<T> {
    getProjectKey(body: T): string;
    getFullKey(body: T): string;
    /**
     * Иванов Иван Иванович
     */
    getIssueId(body: T): number;
    getIssueName(body: T): string;
    getSummary(body: T): string;
    getMembers(body: T): string[];
    getDescriptionFields(body: T): DescriptionFields | undefined;
    getIssueChanges(body: T): IssueChanges[] | undefined;
}

interface PushGetters<T> extends BaseGetters<T> {
    getCommitKeysBody(body: T): Record<string, CommitInfo[]>;
}

interface CommentGetters<T> extends BodyGetters<T> {
    getCommentBody(
        body: T,
    ): {
        id: number;
        body: string;
    };
    isUploadBody(body: T): boolean;
    getUploadUrl(body: T): string | undefined | null;
}

interface IssueGetters<T> extends BodyGetters<T> {
    getRoomName(body: T): string;
}

const missField = translate('miss');

const extractUrl = (text?: string): string | undefined | null => {
    const res = text && text.match(/!\[.*?\]\((.*?)\)/);

    return res && res[1];
};

const getBodyWebhookEvent = (body: any): string | undefined => body?.object_kind;

const getTypeEvent = body => body?.object_attributes?.action;

const composeRoomName = (key: string, { summary, state = IssueStateEnum.open }) => {
    const data = transformFromKey(key);

    return [
        '#' + data.issueId,
        summary.slice(0, 60),
        state,
        [data.namespaceWithProject, 'issues', data.issueId].join('/'),
    ]
        .join(';')
        .concat(';');
};

const isCorrectWebhook = (body: any, hookName: any): boolean =>
    getBodyWebhookEvent(body) === hookName || getTypeEvent(body) === hookName;

const addMsg = (labels: string[], msg: string): string => {
    switch (labels.length) {
        case 0:
            return '';
        case 1:
            return labels.join(', ').concat(' label is ' + msg);
        default:
            return labels.join(', ').concat(' labels are ' + msg);
    }
};

const getCurrentLabelsMsg = (prev: GitlabLabelHook[], current: GitlabLabelHook[]) => {
    const added = differenceBy(current, prev, 'id').map(el => `"${el.title}"`);
    const removed = differenceBy(prev, current, 'id').map(el => `"${el.title}"`);

    const addedMsg = addMsg(added, 'added');
    const removedMsg = addMsg(removed, 'removed');

    return addedMsg + '; ' + removedMsg;
};

const getNamespaceProjectPathFromUrl = (url: string) => {
    try {
        if (!url.startsWith('http')) {
            // it's namespace/project/issues/id pattern
            return url;
        }
        const urlConstr = new URL(url);

        return urlConstr.pathname.slice(1);
    } catch (error) {
        return;
    }
};

const getByIssuePattern = (str: string): string[] => {
    const issueIds = [...str.matchAll(/[\w\/.:]*issues\/[\d]*/g)];

    return issueIds
        .map(([el]) => el)
        .map(getNamespaceProjectPathFromUrl)
        .filter(Boolean)
        .map(el => el!.replace('/issues/', '-'));
};

const getBySharpedPatterns = (str: string, namespace: string): string[] => {
    const sharpIds = [...str.matchAll(/[\w\/]*#[\d]+/g)];

    return sharpIds
        .map(([el]) => el)
        .map(el => (el.startsWith('#') ? namespace.concat(el) : el))
        .map(el => el.replace('#', '-'));
};

export const extractKeysFromCommitMessage = (message: string, nameSpaceWithProject: string): string[] => {
    const sharpFullKeys = getBySharpedPatterns(message, nameSpaceWithProject);
    const issuePatterned = getByIssuePattern(message);

    return union(sharpFullKeys, issuePatterned);
};

const handlers: {
    issue: BodyGetters<GitlabIssueHook>;
    note: CommentGetters<GitlabCommentHook>;
    push: PushGetters<GitlabPushHook>;
} = {
    issue: {
        getProjectKey: body => body.project.path_with_namespace,
        getFullKey: body => transformToKey(body.project.path_with_namespace, body.object_attributes.iid),
        keysForCheckIgnore: body => handlers.issue.getFullKey(body),
        getDisplayName: body => body.user.name,
        getUserId: body => body.user.username,
        getIssueId: body => body.object_attributes.iid,
        getIssueName: body => body.object_attributes.title,
        getSummary: body => body.object_attributes.title,
        getMembers: body => [...body.assignees.map(el => el.name), body.user.name],
        getDescriptionFields: () => undefined,
        getIssueChanges: (body): any[] => {
            if (isCorrectWebhook(body, 'close')) {
                return [{ field: 'status', newValue: IssueStateEnum.close }];
            }
            if (isCorrectWebhook(body, 'reopen')) {
                return [{ field: 'status', newValue: IssueStateEnum.open }];
            }

            return Object.entries(body.changes)

                .filter(([el]) => !el.includes('_'))
                .map(([field, value]) => {
                    switch (field) {
                        case 'description':
                            return { field, newValue: marked(value.current as string) };
                        case 'assignees':
                            return { field, newValue: value.current[0]?.name };
                        case 'labels':
                            return {
                                field,
                                newValue: getCurrentLabelsMsg(
                                    value.previous as GitlabLabelHook[],
                                    value.current as GitlabLabelHook[],
                                ),
                            };
                        default:
                            return { field, newValue: value.current };
                    }
                });
        },
    },
    note: {
        keysForCheckIgnore: body => handlers.note.getFullKey(body),
        getIssueChanges: () => undefined,
        getFullKey: body => transformToKey(body.project.path_with_namespace, body.issue.iid),
        getProjectKey: body => body.project.path_with_namespace,
        getDisplayName: body => body.user.name,
        getUserId: body => body.user.username,
        getCommentBody: body => ({
            id: body.object_attributes.id,
            body: body.object_attributes.note,
        }),
        getIssueId: body => body.issue.iid,
        getIssueName: body => body.issue.title,
        getSummary: body => body.issue.title,
        // Return undefined because there is no way to get expected issue fields by comment hook
        getDescriptionFields: () => undefined,
        getMembers: body => [body.user.name],
        getUploadUrl: body => extractUrl(body.object_attributes.description),
        isUploadBody: body => body.object_attributes.note.includes('](/uploads/'),
    },
    push: {
        getDisplayName: body => body.user_name,
        getUserId: body => body.user_username,
        getCommitKeysBody: body => {
            const nameSpaceWithProject = body.project.path_with_namespace;
            const commits = body.commits;

            const getCommitSendBody = (body: GitlabPushCommit): CommitInfo => ({
                added: body.added,
                author: body.author.name,
                message: body.message,
                modified: body.modified,
                removed: body.removed,
                timestamp: body.timestamp,
                url: body.url,
            });

            const res = commits
                .map(item => {
                    const keys = extractKeysFromCommitMessage(item.message, nameSpaceWithProject);
                    const commitBody = getCommitSendBody(item);

                    return keys.map(key => ({
                        key,
                        commitBody,
                    }));
                })
                .flat();
            const groupedByKeys = groupBy(res, 'key');

            return mapValues(groupedByKeys, el => el.map(({ commitBody }) => commitBody));
        },
        keysForCheckIgnore: body => Object.keys(handlers.push.getCommitKeysBody(body)),
    },
};

const issueRequestHandlers: IssueGetters<GitlabIssue> = {
    getRoomName: body => {
        const key = issueRequestHandlers.getFullKey(body);
        const summary = issueRequestHandlers.getSummary(body);
        const state = body.state === 'closed' ? IssueStateEnum.close : IssueStateEnum.open;
        return composeRoomName(key, { summary, state });
    },
    keysForCheckIgnore: body => issueRequestHandlers.getFullKey(body),
    getIssueChanges: () => undefined,
    getMembers: body => [body.author.username, body.assignee?.username].filter(Boolean) as string[],
    getUserId: body => body.author.username,
    getDisplayName: body => body.author.name,
    getIssueId: body => body.iid,
    getProjectKey: body => {
        const [projectKey] = body.references.full.split('#');

        return projectKey;
    },
    getFullKey: body => transformToKey(issueRequestHandlers.getProjectKey(body), body.iid),
    getIssueName: body => body.title,
    getSummary: body => body.title,
    getDescriptionFields: body => ({
        assigneeName: body.assignee?.name || missField,
        description: body.description,
        epicLink: missField,
        estimateTime: missField,
        priority: missField,
        reporterName: issueRequestHandlers.getDisplayName(body),
        typeName: missField,
    }),
};

const getHandler = (
    body: unknown,
): typeof issueRequestHandlers | typeof handlers.issue | typeof handlers.note | typeof handlers.push | undefined => {
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
    const fullName = handlers.note.getDisplayName(body);
    const userId = handlers.note.getUserId(body);
    const name = `${fullName} ${userId}`;

    return translate('comment_created', { name });
};

const getIssueMembers = body => issueRequestHandlers.getMembers(body);

const getMembers = body => runMethod(body, 'getMembers') || getIssueMembers(body);

const isCommentEvent = body => getBodyWebhookEvent(body) === HookTypes.Comment;

const getIssueCreator = (body: GitlabIssue) => body?.author?.username;

const getDisplayName = body => runMethod(body, 'getDisplayName');

const getProjectKey = body => runMethod(body, 'getProjectKey') || issueRequestHandlers.getProjectKey(body);

const getBodyTimestamp = body => {
    const time: string | undefined = body?.object_attributes?.updated_at || body?.object_attributes?.created_at;
    if (!time) {
        return new Date().getTime();
    }

    return new Date(time).getTime() || time.split(' ').join();
};

const getRedisKey = (funcName: string, body: any): string => [funcName, getBodyTimestamp(body)].join('_');

const getIssueId = body => runMethod(body, 'getIssueId') || issueRequestHandlers.getIssueId(body);

const getIssueKey = body => runMethod(body, 'getFullKey') || issueRequestHandlers.getFullKey(body);

const getIssueName = body => runMethod(body, 'getIssueName') || issueRequestHandlers.getIssueName(body);

const getSummary = body => runMethod(body, 'getSummary') || issueRequestHandlers.getSummary(body);

const getDescriptionFields = (body): DescriptionFields => runMethod(body, 'getDescriptionFields');

const getCreator = body => runMethod(body, 'getUserId');

const getIssueChanges = body => runMethod(body, 'getIssueChanges');

const isUploadBody = handlers.note.isUploadBody;

const getUploadUrl = handlers.note.getUploadUrl;

const getUploadInfo = body => {
    const fullName = handlers.note.getDisplayName(body);
    const userId = handlers.note.getUserId(body);
    const name = `${fullName} ${userId}`;

    return translate('uploadInfo', { name });
};

const keysForCheckIgnore = body => runMethod(body, 'keysForCheckIgnore');

export const selectors: GitlabSelectors = {
    keysForCheckIgnore,
    getCommitKeysBody: handlers['push'].getCommitKeysBody,
    getRoomName: issueRequestHandlers.getRoomName,
    getUploadInfo,
    getUploadUrl,
    isUploadBody,
    transformFromKey,
    composeRoomName,
    getIssueChanges,
    getCreator,
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
