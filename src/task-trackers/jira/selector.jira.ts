import * as R from 'ramda';
import { config } from '../../config';
import { Issue, Relation, DescriptionFields, IssueChanges } from '../../types';
import { translate } from '../../locales';
import { Comment, Changelog, JiraSelectors, IssueLink, ChangelogItem, JiraIssue } from './types';

const { features } = config;

const { epicUpdates, postChangesToLinks } = features;

const { field: epicField } = epicUpdates;

const getIdFromUrl = url => {
    const [res] = url
        .split('/')
        .reverse()
        .slice(2, 3);
    return res;
};

export const extractName = (body, path: string[] = []): string | undefined => R.path([...path, 'displayName'], body);

const handlers = {
    project: {
        getProjectKey: body => R.path(['project', 'key'], body),
        getCreator: body => R.path(['project', 'projectLead', 'name'], body),
        getIssueName: body => handlers.project.getProjectKey(body),
        getMembers: body => [handlers.project.getCreator(body)],
    },
    issue: {
        getDisplayName: (body): string | undefined => R.path(['user', 'displayName'], body),
        getSummary: (body): string | undefined => R.path(['issue', 'fields', 'summary'], body),
        getUserName: (body): string | undefined => R.path(['user', 'name'], body),
        getEpicKey: (body): string | undefined => R.path(['issue', 'fields', epicField], body),
        getType: (body): string | undefined => R.path(['issue', 'fields', 'issuetype', 'name'], body),
        getIssueId: (body): string | undefined => R.path(['issue', 'id'], body),
        getIssueKey: (body): string => R.path(['issue', 'key'], body) as string,
        getCreator: (body): string | undefined => extractName(body, ['issue', 'fields', 'creator']),
        getReporter: (body): string | undefined => extractName(body, ['issue', 'fields', 'reporter']),
        getAssignee: (body): string | undefined => extractName(body, ['issue', 'fields', 'assignee']),
        getMembers: (body): string[] => {
            const possibleMembers = ['getReporter', 'getCreator', 'getAssignee']
                .map(func => handlers.issue[func](body))
                .filter(Boolean);

            return [...new Set(possibleMembers)];
        },
        getChangelog: (body): Changelog | undefined => R.path(['issue', 'changelog'], body),
        getIssueChanges: (body): IssueChanges[] | undefined => {
            const changelog = handlers.issue.getChangelog(body) || handlers.issue.getHookChangelog(body);

            return changelog && changelog.items.map(el => ({ field: el.field, newValue: el.toString }));
        },
        getHookChangelog: (body): Changelog | undefined => R.path(['changelog'], body),
        getProject: (body): string | undefined => R.path(['issue', 'fields', 'project'], body),
        getProjectKey: (body): string | undefined => R.path(['key'], handlers.issue.getProject(body)),
        getIssueName: (body): string | undefined => handlers.issue.getIssueKey(body),
        getLinks: (body): IssueLink[] => R.pathOr([], ['issue', 'fields', 'issuelinks'], body),
    },
    comment: {
        getComment: (body): string | undefined => R.path(['comment'], body),
        getDisplayName: (body): string | undefined => R.path(['comment', 'author', 'displayName'], body),
        getAuthor: (body): string | undefined => R.path(['comment', 'author', 'displayName'], body),
        getUpdateAuthor: (body): string | undefined => R.path(['comment', 'updateAuthor', 'displayName'], body),
        getCreator: (body): string | undefined =>
            handlers.comment.getUpdateAuthor(body) || handlers.comment.getAuthor(body),
        getUrl: (body): string | undefined => R.path(['comment', 'self'], body),
        getIssueId: (body): string | undefined => getIdFromUrl(handlers.comment.getUrl(body)),
        getIssueName: (body): string | undefined => handlers.comment.getIssueId(body),
        getCommentBody: body => ({
            body: R.path(['comment', 'body'], body) as string,
            id: R.path(['comment', 'id'], body) as string,
        }),
    },
    issuelink: {
        getLinks: body => [R.path(['issueLink'], body)],
        getIssueName: (body): string | undefined => R.path(['issueLink', 'id'], body),
        getIssueLinkSourceId: (body): string | undefined => R.path(['issueLink', 'sourceIssueId'], body),
        getIssueLinkDestinationId: (body): string | undefined => R.path(['issueLink', 'destinationIssueId'], body),
        getNameIssueLinkType: (body): string | undefined => R.path(['issueLink', 'issueLinkType', 'name'], body),
        getSourceRelation: (body): string | undefined => R.path(['issueLink', 'issueLinkType', 'outwardName'], body),
        getDestinationRelation: (body): string | undefined =>
            R.path(['issueLink', 'issueLinkType', 'inwardName'], body),
    },
};

export const getBodyWebhookEvent = (body): string | undefined => R.path(['webhookEvent'], body);

// * ----------------------- Webhook selectors ------------------------- *

export const getTypeEvent = (body: Issue): string | undefined => R.path(['issue_event_type_name'], body);

export const getIssueCreator = (issue: Issue): string | undefined => handlers.issue.getCreator({ issue });

export const getIssueMembers = (issue: Issue): string[] => handlers.issue.getMembers({ issue });

export const getHookType = body => {
    const eventType = getTypeEvent(body);
    if (eventType) {
        return 'issue';
    }
    const event = getBodyWebhookEvent(body);

    return event && event.split('_')[0];
};

export const getHandler = body => {
    const type = getHookType(body);

    return type && handlers[type];
};

export const runMethod = (body: any, method: string): any => {
    const handler = getHandler(body);

    return handler && handler[method] && handler[method](body);
};

const getIssueChanges = (body): IssueChanges[] | undefined => runMethod(body, 'getIssueChanges');

export const getDisplayName = body => runMethod(body, 'getDisplayName');

export const getMembers = body => runMethod(body, 'getMembers') || handlers.issue.getMembers({ issue: body });

export const getIssueId = (body): string => runMethod(body, 'getIssueId');

export const getIssueKey = body => runMethod(body, 'getIssueKey') || handlers.issue.getIssueKey({ issue: body });

export const getIssueName = body => runMethod(body, 'getIssueName');

export const getProjectKey = body => runMethod(body, 'getProjectKey') || handlers.issue.getProjectKey({ issue: body });

export const getLinks = body => runMethod(body, 'getLinks');

const getChangelog = (body): Changelog | undefined => {
    const type = getHandler(body);

    return type.getChangelog(body) || type.getHookChangelog(body);
};

export const getCommentAuthor = (body: Comment): string | undefined => handlers.comment.getAuthor(body);

export const getComment = body => handlers.comment.getComment(body);

export const getCommentBody = (body: Comment): { body: string; id: string } => handlers.comment.getCommentBody(body);

export const getEpicKey = (body): string | undefined => handlers.issue.getEpicKey(body);

export const getKey = (body: Issue | any): string | undefined =>
    handlers.issue.getIssueKey(body) || R.path(['key'], body);

export const getIssueLinkSourceId = (body): string | undefined => handlers.issuelink.getIssueLinkSourceId(body);

export const getIssueLinkDestinationId = body => handlers.issuelink.getIssueLinkDestinationId(body);

export const getNameIssueLinkType = body => handlers.issuelink.getNameIssueLinkType(body);

export const getSourceRelation = body => handlers.issuelink.getSourceRelation(body);

export const getDestinationRelation = body => handlers.issuelink.getDestinationRelation(body);

export const getResponcedSummary = (body: Issue): string | undefined => R.path(['fields', 'summary'], body);

export const getSummary = (body): string => runMethod(body, 'getSummary') || getResponcedSummary(body);

export const getBodyTimestamp = (body): number | undefined => R.path(['timestamp'], body);

export const getRedisKey = (funcName: string, body: any): string => [funcName, getBodyTimestamp(body)].join('_');

const getChangelogItems = (body): ChangelogItem[] => R.pathOr([], ['items'], getChangelog(body));

export const isCorrectWebhook = (body: any, hookName: any): boolean => getBodyWebhookEvent(body) === hookName;

export const isEpic = (body): boolean => handlers.issue.getType(body) === 'Epic';

export const isCommentEvent = (body): boolean =>
    getHookType(body) === 'comment' && !getBodyWebhookEvent(body)?.includes('deleted');

/**
 * Get changelog field body from webhook from jira
 * @param {string} fieldName key of changelog field
 * @param {object} body webhook body
 * @returns {object} changelog field
 */
export const getChangelogField = (fieldName, body): ChangelogItem | undefined =>
    getChangelogItems(body).find((item: ChangelogItem) => item.field === fieldName);

export const getNewSummary = (body): string | undefined => R.path(['toString'], getChangelogField('summary', body));

export const getNewStatus = (body): string | undefined => R.path(['toString'], getChangelogField('status', body));

export const getNewStatusId = (body): string | undefined => R.path(['to'], getChangelogField('status', body));

export const getNewKey = (body): string | undefined => R.path(['toString'], getChangelogField('Key', body));

export const getOldKey = (body): string | undefined => R.path(['fromString'], getChangelogField('Key', body));

export const getRelations = (issueLinkBody): { inward: Relation; outward: Relation } => ({
    inward: {
        relation: R.path(['type', 'inward'], issueLinkBody),
        related: issueLinkBody.inwardIssue,
    },
    outward: {
        relation: R.path(['type', 'outward'], issueLinkBody),
        related: issueLinkBody.outwardIssue,
    },
});

export const getTextIssue = (body, path): string => {
    const params = path.split('.');
    const baseParams = body.issue ? ['issue', 'fields'] : ['fields'];
    const text = String(R.path([...baseParams, ...params], body) || translate('miss')).trim();

    return text;
};

export const getDescriptionFields = (body): DescriptionFields => ({
    assigneeName: getTextIssue(body, 'assignee.displayName'),
    reporterName: getTextIssue(body, 'reporter.displayName'),
    typeName: getTextIssue(body, 'issuetype.name'),
    epicLink: getTextIssue(body, 'customfield_10006'),
    estimateTime: getTextIssue(body, 'timetracking.originalEstimate'),
    description: getTextIssue(body, 'description'),
    priority: getTextIssue(body, 'priority.name'),
});

export const getHeaderText = body => {
    const name = handlers.comment.getDisplayName(body);
    const eventName = getBodyWebhookEvent(body);

    return translate(eventName!, { name });
};

export const getLinkKeys = (body): string[] => {
    const links = getLinks(body);

    return links.reduce((acc, link) => {
        const destIssue = R.either(R.prop('outwardIssue'), R.prop('inwardIssue'))(link) as any;

        const destStatusCat = R.path(['fields', 'status', 'statusCategory', 'id'], destIssue) as number;
        if (postChangesToLinks.ignoreDestStatusCat.includes(destStatusCat)) {
            return acc;
        }
        return [...acc, destIssue.key];
    }, []);
};

// * ------------------------- Request selectors ------------------------- *

export const getInwardLinkKey = (body): string | undefined => R.path(['inwardIssue', 'key'], body);

export const getOutwardLinkKey = (body): string | undefined => R.path(['outwardIssue', 'key'], body);

export const getCreator = hook => runMethod(hook, 'getCreator');

export interface GetFieldOptions {
    type: 'issue';
    name: 'key';
}

const composeRoomName = (key, { summary }) => `${key} ${summary}`;

const getRoomName = body => {
    const key = getIssueKey(body);
    const summary = getSummary(body);

    return composeRoomName(key, { summary });
};

export const selectors: JiraSelectors = {
    getMilestoneViewUrl: () => '',
    getMilestoneRoomName: () => undefined,
    isIssueRoomName: key => key.includes('-'),
    getMilestoneSummary: () => undefined,
    getMilestoneKey: () => undefined,
    getIssueColor: (body: JiraIssue) => body.fields.status.statusCategory.colorName,
    getRoomName,
    composeRoomName,
    getIssueChanges,
    getCreator,
    extractName,
    getBodyWebhookEvent,
    getTypeEvent,
    getIssueCreator,
    getIssueMembers,
    getHookType,
    getDisplayName,
    getMembers,
    getIssueId,
    getIssueKey,
    getIssueName,
    getProjectKey,
    getLinks,
    getComment,
    getCommentBody,
    getEpicKey,
    getKey,
    getIssueLinkSourceId,
    getIssueLinkDestinationId,
    getNameIssueLinkType,
    getSourceRelation,
    getDestinationRelation,
    getSummary,
    getBodyTimestamp,
    getRedisKey,
    isCorrectWebhook,
    isEpic,
    isCommentEvent,
    getChangelogField,
    getNewSummary,
    getNewStatus,
    getNewStatusId,
    getNewKey,
    getOldKey,
    getRelations,
    getDescriptionFields,
    getHeaderText,
    getLinkKeys,
    getInwardLinkKey,
    getOutwardLinkKey,
};
