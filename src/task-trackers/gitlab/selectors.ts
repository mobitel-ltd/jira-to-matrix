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
    GitlabPipelineHook,
} from './types';
import marked from 'marked';
import { translate } from '../../locales';
import { DescriptionFields, IssueChanges, RoomViewStateEnum } from '../../types';
import { URL } from 'url';

export enum KeyType {
    Issue,
    Milestone,
}

export const milestonePart = 'milestone';

const getIdType = (formatedId: string): KeyType =>
    formatedId.includes(milestonePart) ? KeyType.Milestone : KeyType.Issue;

const transformFromKey = (
    key: string,
):
    | { namespaceWithProject: string; issueId: number; milestoneId?: number }
    | { namespaceWithProject: string; milestoneId: number; issueId?: number } => {
    const [id, ...keyReversedParts] = key
        .toLowerCase()
        .split('-')
        .reverse();
    const namespaceWithProject = keyReversedParts.reverse().join('-');
    const type = getIdType(id);

    return type === KeyType.Issue
        ? { namespaceWithProject, issueId: Number(id) }
        : { namespaceWithProject, milestoneId: Number(id.replace(milestonePart, '')) };
};

/**
 * @example namespace/project-123
 */
const transformFromIssueKey = (key: string): { namespaceWithProject: string; issueId: number } => {
    return transformFromKey(key) as { namespaceWithProject: string; issueId: number };
};

const isIssueRoomName = (key: string): boolean => {
    const data = transformFromKey(key);

    return Boolean(data.issueId);
};

export const transformToKey = (namespaceWithProject: string, id: number, type = KeyType.Issue): string => {
    if (type === KeyType.Issue) {
        return [namespaceWithProject, id].join('-');
    }
    const formatedId = milestonePart + id;

    return formatedId;
};

interface BaseGetters<T> {
    getDisplayName(body: T): string;
    /**
     * ii_ivanov
     */
    getUserId(body: T): string;
    keysForCheckIgnore(body: T): string[] | string;
    // TODO add it!!!
    // getBodyTimestamp(body: T): string;
}

interface BodyGetters<T = unknown> extends BaseGetters<T> {
    getIssueLabels(body: T): GitlabLabelHook[] | string[];
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

interface IssueHookGetters<T = unknown> extends BodyGetters<T> {
    getMilestoneId(body: T): number | null;
}

interface PushGetters<T> extends BaseGetters<T> {
    getCommitKeysBody(body: T): Record<string, GitlabPushCommit[]>;
    getFullNameWithId(body: T): string;
    getProjectKey(body: T): string;
}

interface PipelineGetters extends BaseGetters<GitlabPipelineHook> {
    getFullNameWithId(body: GitlabPipelineHook): string;
    getPipelineStatus(body: GitlabPipelineHook): string;
    isFinalPipeline(body: GitlabPipelineHook): boolean;
    getIssueKeys(body: GitlabPipelineHook): string[];
}

interface CommentGetters<T> extends IssueHookGetters<T> {
    getFullNameWithId(body: T): string;
    getCommentBody(
        body: T,
    ): {
        id: number;
        body: string;
    };
    isUploadBody(body: T): boolean;
    getUploadUrl(body: T): string[] | undefined | null;
}

interface IssueGetters<T> extends BodyGetters<T> {
    getRoomName(body: T): string;
    getMilestoneKey(body: T, id?: number): string | undefined;
    getMilestoneSummary(body: T): string | undefined;
    getAssigneeDisplayName(body: T): string[];
    getAssigneeUserId(body: T): string[];
    getMilestoneRoomName(body: T): string | undefined;
    getMilestoneViewUrl(body: T): string;
}

const missField = translate('miss');

// const extractUrl = (text?: string): string | undefined | null => {
//     const res = text && text.match(/\[.*?\]\((.*?)\)/);

//     return res && res[1];
// };

const extractUrl = (text: string): string[] | undefined | null => {
    const regexp = /\[.*?\]\((.*?)\)/g;
    const array = [...text.matchAll(regexp)].map(matched => matched[1]);
    return array;
};

const getBodyWebhookEvent = (body: any): string | undefined => body?.object_kind;

const getTypeEvent = body => body?.object_attributes?.action;

const composeRoomName = (key: string, { summary, state = RoomViewStateEnum.open, milestone = '' }) => {
    const data = transformFromKey(key);
    const optionTypes: Record<KeyType, (project: string, id: number) => string[]> = {
        [KeyType.Issue]: (project, id) => [
            '#' + id,
            summary.slice(0, 60),
            state,
            [project, 'issues', id].join('/'),
            milestone,
        ],
        [KeyType.Milestone]: (project, id) => ['#' + id, summary.slice(0, 60), [project, 'milestones', id].join('/')],
    };
    const type = data.issueId ? KeyType.Issue : KeyType.Milestone;

    const options = optionTypes[type](data.namespaceWithProject, (data.issueId || data.milestoneId)!);

    return options.join(';').concat(';');
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
    const issueIds = [...str.matchAll(/[\w\/.\-:]*issues\/[\d]*/g)];

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

const getFullName = (displayName: string, userId: string) => [userId, `${displayName}`].join(' ');

const handlers: {
    issue: IssueHookGetters<GitlabIssueHook>;
    note: CommentGetters<GitlabCommentHook>;
    push: PushGetters<GitlabPushHook>;
    pipeline: PipelineGetters;
} = {
    issue: {
        getMilestoneId: body => {
            const isMilestoneDeleted = data => {
                const changes = handlers.issue.getIssueChanges(data);
                if (changes) {
                    const newMilestone = changes.find(el => el.field === 'milestone_id');

                    const res = newMilestone && !newMilestone.newValue;

                    return Boolean(res);
                }

                return false;
            };

            const deletedStatus = isMilestoneDeleted(body);

            if (deletedStatus) {
                const previos = body.changes.milestone_id?.previous;

                return previos ? previos : null;
            }

            return body.object_attributes.milestone_id;
        },

        getProjectKey: body => body.project.path_with_namespace,
        getIssueLabels: body => body.labels,
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
                return [{ field: 'status', newValue: RoomViewStateEnum.close }];
            }
            if (isCorrectWebhook(body, 'reopen')) {
                return [{ field: 'status', newValue: RoomViewStateEnum.open }];
            }

            return (
                Object.entries(body.changes)
                    .filter(([el]) => !(el.includes('_at') || el.includes('_by') || el.includes('_position')))
                    //.filter(([el]) => !['_position', '_at', '_by'].includes(el))
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
                            case 'milestone_id':
                                return { field, newValue: value.current };
                            default:
                                return { field, newValue: value.current };
                        }
                    })
            );
        },
        // getBodyTimestamp: body => body.object_attributes.created_at,
    },
    note: {
        getMilestoneId: body => body.issue.milestone_id,
        getIssueLabels: body => body.issue.labels,
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
        getUploadUrl: body => {
            if (body.object_attributes.description?.includes('https://')) {
                return extractUrl(body.object_attributes.description);
            }

            const base = body.object_attributes.description.split('(');
            return [body.project.web_url + base[1].slice(0, -1)];
        },
        isUploadBody: body => body.object_attributes.note.includes('](/uploads/'),
        getFullNameWithId: body => getFullName(handlers.note.getDisplayName(body), handlers.note.getUserId(body)),
    },
    push: {
        getProjectKey: body => body.project.path_with_namespace,
        getDisplayName: body => body.user_name,
        getUserId: body => body.user_username,
        getCommitKeysBody: body => {
            const nameSpaceWithProject = body.project.path_with_namespace;
            const commits = body.commits;

            const res = commits
                .map(item => {
                    const keys = extractKeysFromCommitMessage(item.message, nameSpaceWithProject);

                    return keys.map(key => ({
                        key,
                        commitBody: item,
                    }));
                })
                .flat();
            const groupedByKeys = groupBy(res, 'key');

            return mapValues(groupedByKeys, el => el.map(({ commitBody }) => commitBody));
        },
        keysForCheckIgnore: body => Object.keys(handlers.push.getCommitKeysBody(body)),
        getFullNameWithId: body => getFullName(handlers.push.getDisplayName(body), handlers.push.getUserId(body)),
    },
    pipeline: {
        getDisplayName: body => body.user.name,
        getUserId: body => body.user.username,
        getFullNameWithId: body =>
            getFullName(handlers.pipeline.getDisplayName(body), handlers.pipeline.getUserId(body)),
        getPipelineStatus: body => body.object_attributes.status,
        isFinalPipeline: body => !['running', 'pending'].includes(handlers.pipeline.getPipelineStatus(body)),
        getIssueKeys: body => {
            const nameSpaceWithProject = body.project.path_with_namespace;

            return extractKeysFromCommitMessage(body.commit.message, nameSpaceWithProject);
        },
        keysForCheckIgnore: body => handlers.pipeline.getIssueKeys(body),
    },
};

const issueRequestHandlers: IssueGetters<GitlabIssue> = {
    getMilestoneViewUrl: body => body.milestone!.web_url,
    getMilestoneSummary: body => body.milestone?.title,
    getMilestoneKey: (body, id) => {
        const milestoneId = id || body.milestone?.id;
        if (milestoneId) {
            const projectKey = issueRequestHandlers.getProjectKey(body);

            return transformToKey(projectKey, milestoneId, KeyType.Milestone);
        }
    },
    getIssueLabels: body => body.labels || [],
    getRoomName: body => {
        const key = issueRequestHandlers.getFullKey(body);
        const summary = issueRequestHandlers.getSummary(body);
        const milestone = body.milestone === null ? '' : body.milestone.title;
        const state = body.state === RoomViewStateEnum.close ? RoomViewStateEnum.close : RoomViewStateEnum.open;

        return composeRoomName(key, { summary, state, milestone });
    },
    getMilestoneRoomName: body => {
        if (body.milestone) {
            const mil = body.milestone;
            const linkPart = new URL(mil.web_url).pathname.replace('/-/', '/').slice(1);

            const data = ['#' + mil.id, mil.title.slice(0, 60), mil.state, linkPart];

            return data.join(';').concat(';');
        }
    },
    keysForCheckIgnore: body => issueRequestHandlers.getFullKey(body),
    getIssueChanges: () => undefined,
    getMembers: body => [body.author.username, body.assignee?.username].filter(Boolean) as string[],
    getAssigneeDisplayName: body => [body.assignee?.name].filter(Boolean) as string[],
    getAssigneeUserId: body => [body.assignee?.username].filter(Boolean) as string[],
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

// function getHandler(body: unknown): undefined;
function getHandler(body: GitlabPipelineHook): typeof handlers.pipeline;
function getHandler(body: GitlabPushHook): typeof handlers.push;
function getHandler(
    body: unknown | GitlabPipelineHook | GitlabPushHook,
):
    | typeof issueRequestHandlers
    | typeof handlers.issue
    | typeof handlers.note
    | typeof handlers.push
    | typeof handlers.pipeline
    | undefined {
    const type = getBodyWebhookEvent(body);

    return (type && handlers[type]) || issueRequestHandlers;
}

const isIgnoreHookType = (body): boolean => {
    const type = getBodyWebhookEvent(body);

    return !Boolean(type && handlers[type]);
};

const runMethod = (body: any, method: keyof IssueHookGetters): any => {
    const handler = getHandler(body);

    return handler && handler[method] && handler[method](body);
};

const getHeaderText = body => {
    const name = handlers.note.getFullNameWithId(body);

    return translate('comment_created', { name });
};

const getIssueMembers = body => issueRequestHandlers.getMembers(body);

const getMembers = body => runMethod(body, 'getMembers') || getIssueMembers(body);

const isCommentEvent = body => getBodyWebhookEvent(body) === HookTypes.Comment;

const getIssueCreator = (body: GitlabIssue) => body?.author?.username;

const getDisplayName = body => runMethod(body, 'getDisplayName');

const getProjectKey = body => runMethod(body, 'getProjectKey') || issueRequestHandlers.getProjectKey(body);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getBodyTimestamp = (body): number => {
    return Date.now();
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

const getIssueLabels = body => runMethod(body, 'getIssueLabels');

const getUploadUrl = handlers.note.getUploadUrl;

const getUploadInfo = body => {
    const name = getFullName(handlers.note.getDisplayName(body), handlers.note.getUserId(body));

    return translate('uploadInfo', { name });
};

const keysForCheckIgnore = body => runMethod(body, 'keysForCheckIgnore');

const isPipelineHook = (body: unknown) =>
    isCorrectWebhook(body, HookTypes.Pipeline) && handlers.pipeline.isFinalPipeline(body as GitlabPipelineHook);

const getMilestoneId = (body): number | null => runMethod(body, 'getMilestoneId');

const getMilestoneKey = (body, milestoneId?: number): string | undefined =>
    issueRequestHandlers.getMilestoneKey(body, milestoneId);

export const extractProjectNameFromIssueKey = (key: string): string => {
    const keyData = this.selectors.transformFromIssueKey(key);
    return keyData.namespaceWithProject.split('/').reverse()[0];
};

export const selectors: GitlabSelectors = {
    getMilestoneViewUrl: issueRequestHandlers.getMilestoneViewUrl,
    isIssueRoomName,
    getAssigneeDisplayName: issueRequestHandlers.getAssigneeDisplayName,
    getAssigneeUserId: issueRequestHandlers.getAssigneeUserId,
    getMilestoneSummary: issueRequestHandlers.getMilestoneSummary,
    transformFromKey,
    getMilestoneKey,
    getMilestoneId,
    getPostKeys: handlers.pipeline.getIssueKeys,
    isPipelineHook,
    getIssueLabels,
    getFullNameWithId: body => {
        const handler = getHandler(body as any);

        return handler.getFullNameWithId(body as any);
    },
    keysForCheckIgnore,
    getCommitKeysBody: handlers['push'].getCommitKeysBody,
    getRoomName: issueRequestHandlers.getRoomName,
    getMilestoneRoomName: issueRequestHandlers.getMilestoneRoomName,
    getUploadInfo,
    getUploadUrl,
    isUploadBody,
    transformFromIssueKey,
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
    extractProjectNameFromIssueKey,
};
