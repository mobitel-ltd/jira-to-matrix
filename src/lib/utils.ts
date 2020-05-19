import { translate } from '../locales';
import Ramda from 'ramda';
import { config } from '../config';
import * as messages from './messages';
import { Issue } from '../types';

const { jira, features, messenger } = config;

const { epicUpdates, postChangesToLinks } = features;

const { field: epicField } = epicUpdates;
const { url: jiraUrl } = jira;

export const TIMEOUT = 60000;
export const REDIS_ROOM_KEY = 'newrooms';
// TODO: change until start correct bot work
const ROOMS_OLD_NAME = 'rooms';
const REDIS_LINK_PREFIX = 'link';
const REDIS_EPIC_PREFIX = 'epic';
export const REDIS_IGNORE_PREFIX = 'ignore:project';
export const REDIS_INVITE_PREFIX = 'invite:project';
export const REDIS_ALIASES = 'aliases';
export const HANDLED_KEY = 'handled';
export const ARCHIVE_PROJECT = 'archiveProject';
export const LAST_STATUS_COLOR = 'green';

const DELIMITER = '|';
const KEYS_TO_IGNORE = [
    REDIS_ALIASES,
    ROOMS_OLD_NAME,
    DELIMITER,
    REDIS_IGNORE_PREFIX,
    REDIS_INVITE_PREFIX,
    HANDLED_KEY,
    ARCHIVE_PROJECT,
];

export const [COMMON_NAME] = messenger.domain.split('.').slice(1, 2);
const JIRA_REST = 'rest/api/2';

export const INDENT = '&nbsp;&nbsp;&nbsp;&nbsp;';
const LINE_BREAKE_TAG = '<br>';
export const NO_ROOM_PATTERN = 'No roomId for ';
export const END_NO_ROOM_PATTERN = ' from Matrix';

export const httpStatus = {
    OK: 200,
    BAD_REQUEST: 404,
};

const getIdFromUrl = url => {
    const [res] = url
        .split('/')
        .reverse()
        .slice(2, 3);
    return res;
};

const getNameFromMail = mail => mail && mail.split('@')[0];

const extractName = (body, path: string[] = []) => Ramda.path([...path, 'displayName'], body);

export const getBodyWebhookEvent = body => Ramda.path(['webhookEvent'], body);

const handlers = {
    project: {
        getProjectKey: body => Ramda.path(['project', 'key'], body),
        getCreatorDisplayName: body => getNameFromMail(Ramda.path(['project', 'projectLead', 'emailAddress'], body)),
        getCreator: body => Ramda.path(['project', 'projectLead', 'name'], body),
        getIssueName: body => handlers.project.getProjectKey(body),
        getMembers: body => [handlers.project.getCreator(body)],
    },
    issue: {
        getDisplayName: body => Ramda.path(['user', 'displayName'], body),
        getSummary: body => Ramda.path(['issue', 'fields', 'summary'], body),
        getUserName: body => Ramda.path(['user', 'name'], body),
        getEpicKey: body => Ramda.path(['issue', 'fields', epicField], body),
        getType: body => Ramda.path(['issue', 'fields', 'issuetype', 'name'], body),
        getIssueId: body => Ramda.path(['issue', 'id'], body),
        getIssueKey: (body): string => Ramda.path(['issue', 'key'], body) as string,
        getCreatorDisplayName: body =>
            getNameFromMail(Ramda.path(['issue', 'fields', 'creator', 'emailAddress'], body)),
        getCreator: body => extractName(body, ['issue', 'fields', 'creator']),
        getReporter: body => extractName(body, ['issue', 'fields', 'reporter']),
        getAssignee: body => extractName(body, ['issue', 'fields', 'assignee']),
        getMembers: body => {
            const possibleMembers = ['getReporter', 'getCreator', 'getAssignee']
                .map(func => handlers.issue[func](body))
                .filter(Boolean);

            return [...new Set(possibleMembers)];
        },
        getChangelog: body => Ramda.path(['issue', 'changelog'], body),
        getHookChangelog: body => Ramda.path(['changelog'], body),
        getProject: body => Ramda.path(['issue', 'fields', 'project'], body),
        getProjectKey: body => Ramda.path(['key'], handlers.issue.getProject(body)),
        getIssueName: body => handlers.issue.getIssueKey(body),
        getLinks: body => Ramda.path(['issue', 'fields', 'issuelinks'], body),
    },
    comment: {
        getComment: body => Ramda.path(['comment'], body),
        getDisplayName: body => Ramda.path(['comment', 'author', 'displayName'], body),
        getAuthor: body => Ramda.path(['comment', 'author', 'name'], body),
        getUpdateAuthor: body => Ramda.path(['comment', 'updateAuthor', 'name'], body),
        getCreatorDisplayName: body =>
            getNameFromMail(Ramda.path(['comment', 'updateAuthor', 'emailAddress'], body)) ||
            getNameFromMail(Ramda.path(['comment', 'author', 'emailAddress'], body)),
        getCreator: body => handlers.comment.getUpdateAuthor(body) || handlers.comment.getAuthor(body),
        getUrl: body => Ramda.path(['comment', 'self'], body),
        getIssueId: body => getIdFromUrl(handlers.comment.getUrl(body)),
        getIssueName: body => handlers.comment.getIssueId(body),
        getCommentBody: body => ({
            body: Ramda.path(['comment', 'body'], body),
            id: Ramda.path(['comment', 'id'], body),
        }),
    },
    issuelink: {
        getLinks: body => [Ramda.path(['issueLink'], body)],
        getIssueName: body => Ramda.path(['issueLink', 'id'], body),
        getIssueLinkSourceId: body => Ramda.path(['issueLink', 'sourceIssueId'], body),
        getIssueLinkDestinationId: body => Ramda.path(['issueLink', 'destinationIssueId'], body),
        getNameIssueLinkType: body => Ramda.path(['issueLink', 'issueLinkType', 'name'], body),
        getSourceRelation: body => Ramda.path(['issueLink', 'issueLinkType', 'outwardName'], body),
        getDestinationRelation: body => Ramda.path(['issueLink', 'issueLinkType', 'inwardName'], body),
    },
};

// * ----------------------- Webhook selectors ------------------------- *

export const getResponcedSummary = body => Ramda.path(['fields', 'summary'], body);

export const getTypeEvent = body => Ramda.path(['issue_event_type_name'], body);

export const getIssueCreator = issue => handlers.issue.getCreator({ issue });

export const getIssueAssignee = issue => handlers.issue.getAssignee({ issue });

export const getIssueMembers = issue => handlers.issue.getMembers({ issue });

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

export const runMethod = (body, method) => {
    const handler = getHandler(body);

    return handler && handler[method] && handler[method](body);
};

export const getDisplayName = body => runMethod(body, 'getDisplayName');

export const getMembers = body => runMethod(body, 'getMembers') || handlers.issue.getMembers({ issue: body });

export const getIssueId = body => runMethod(body, 'getIssueId');

export const getIssueKey = body => runMethod(body, 'getIssueKey');

export const getIssueName = body => runMethod(body, 'getIssueName');

export const getCreatorDisplayName = body => runMethod(body, 'getCreatorDisplayName');

export const getProjectKey = body => runMethod(body, 'getProjectKey') || handlers.issue.getProjectKey(body);

export const getLinks = body => runMethod(body, 'getLinks');

export const getChangelog = body => {
    const type = getHandler(body);

    return type.getChangelog(body) || type.getHookChangelog(body);
};

export const getCommentAuthor = body => handlers.comment.getAuthor(body);

export const getComment = body => handlers.comment.getComment(body);

export const getCommentBody = body => handlers.comment.getCommentBody(body);

export const getUserName = body => handlers.issue.getUserName(body);

export const getEpicKey = body => handlers.issue.getEpicKey(body);

export const getKey = (body: Issue): string | undefined =>
    handlers.issue.getIssueKey(body) || Ramda.path(['key'], body);

export const getIssueLinkSourceId = body => handlers.issuelink.getIssueLinkSourceId(body);

export const getIssueLinkDestinationId = body => handlers.issuelink.getIssueLinkDestinationId(body);

export const getNameIssueLinkType = body => handlers.issuelink.getNameIssueLinkType(body);

export const getSourceRelation = body => handlers.issuelink.getSourceRelation(body);

export const getDestinationRelation = body => handlers.issuelink.getDestinationRelation(body);

export const getSummary = body => runMethod(body, 'getSummary') || getResponcedSummary(body);

export const getBodyTimestamp = body => Ramda.path(['timestamp'], body);

export const getHookUserName = body => getCommentAuthor(body) || getUserName(body) || getDisplayName(body);

export const getChangelogItems = body => Ramda.pathOr([], ['items'], getChangelog(body));

export const isCorrectWebhook = (body, hookName) => getBodyWebhookEvent(body) === hookName;

export const isEpic = body => handlers.issue.getType(body) === 'Epic';

export const isCommentEvent = body => getHookType(body) === 'comment' && !getBodyWebhookEvent(body).includes('deleted');

/**
 * Get changelog field body from webhook from jira
 * @param {string} fieldName key of changelog field
 * @param {object} body webhook body
 * @returns {object} changelog field
 */
export const getChangelogField = (fieldName, body) => getChangelogItems(body).find(item => item.field === fieldName);

export const getNewSummary = body => Ramda.path(['toString'], getChangelogField('summary', body));

export const getNewStatus = body => Ramda.path(['toString'], getChangelogField('status', body));

export const getNewStatusId = body => Ramda.path(['to'], getChangelogField('status', body));

export const getNewKey = body => Ramda.path(['toString'], getChangelogField('Key', body));

export const getOldKey = body => Ramda.path(['fromString'], getChangelogField('Key', body));

export const getRelations = issueLinkBody => ({
    inward: {
        relation: Ramda.path(['type', 'inward'], issueLinkBody),
        related: issueLinkBody.inwardIssue,
    },
    outward: {
        relation: Ramda.path(['type', 'outward'], issueLinkBody),
        related: issueLinkBody.outwardIssue,
    },
});

export const getTextIssue = (body, path) => {
    const params = path.split('.');
    const text = String(Ramda.path(['issue', 'fields', ...params], body) || translate('miss')).trim();

    return text;
};

export const getDescriptionFields = body => ({
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

    return translate(eventName, { name });
};

export const getLinkKeys = body => {
    const links = getLinks(body);

    return links.reduce((acc, link) => {
        const destIssue = Ramda.either(Ramda.prop('outwardIssue'), Ramda.prop('inwardIssue'))(link);

        const destStatusCat = Ramda.path(['fields', 'status', 'statusCategory', 'id'], destIssue);
        if (postChangesToLinks.ignoreDestStatusCat.includes(destStatusCat)) {
            return acc;
        }
        return [...acc, destIssue.key];
    }, []);
};

// * ------------------------- Request selectors ------------------------- *

export const getInwardLinkKey = body => Ramda.path(['inwardIssue', 'key'], body);

export const getOutwardLinkKey = body => Ramda.path(['outwardIssue', 'key'], body);

// * --------------------------------- Redis utils ------------------------------- *

export const getRedisLinkKey = id => [REDIS_LINK_PREFIX, DELIMITER, id].join('');

export const getRedisEpicKey = id => [REDIS_EPIC_PREFIX, DELIMITER, id].join('');

export const getRedisKey = (funcName, body) => [funcName, getBodyTimestamp(body)].join('_');

export const isIgnoreKey = key => !KEYS_TO_IGNORE.some(val => key.includes(val));

// * --------------------------------- Error handling ---------------------------- *

export const getDefaultErrorLog = funcName => `Error in ${funcName}`;

export const errorTracing = (name, err) => {
    const log = messages[name] || getDefaultErrorLog(name);

    return [log, err].join('\n');
};

// * --------------------------------- Request utils ------------------------------- *

export const getRestUrl = (...args) => [jiraUrl, JIRA_REST, ...args].join('/');

export const getViewUrl = (key, type = 'browse') => [jiraUrl, type, key].join('/');

// * --------------------------------- Matrix utils ------------------------------- *

// Parse body of event from Matrix
export const parseEventBody = body => {
    try {
        const trimedBody = body.trim();

        const commandName = trimedBody
            .split(' ')[0]
            .match(/^!\w+$/g)[0]
            .substring(1);

        if (`!${commandName}` === trimedBody) {
            return { commandName };
        }

        const bodyText = trimedBody.replace(`!${commandName}`, '').trim();

        return { commandName, bodyText };
    } catch (err) {
        return {};
    }
};

export const getKeyFromError = str => {
    const start = str.indexOf(NO_ROOM_PATTERN) + NO_ROOM_PATTERN.length;
    const end = str.indexOf(END_NO_ROOM_PATTERN);
    return str.slice(start, end);
};

export const isNoRoomError = errStr => errStr.includes(NO_ROOM_PATTERN);

export const isAdmin = user => messenger.admins.includes(user);

// * --------------------------------- Other utils ------------------------------- *

export const isOdd = num => Boolean(num % 2);

export const getProjectKeyFromIssueKey = issueKey => Ramda.head(issueKey.split('-'));

export const getListToHTML = list =>
    list.reduce((acc, { displayName }) => `${acc}<strong>${displayName}<br>`, `${translate('listUsers')}:<br>`);

export const getCommandList = list =>
    list.reduce(
        (acc, { name, id }, index) => `${acc}<strong>${index + 1})</strong> - ${name}<br>`,
        `${translate('listJiraCommand')}:<br>`,
    );

export const getIgnoreTips = (projectKey, currentSettingsList, command) => {
    if (currentSettingsList.length === 0) {
        return `${translate('emptySettingsList', { projectKey })}`;
    }
    switch (command) {
        case 'ignore':
            return `${translate('currentIgnoreSettings', { projectKey })}
                <br>
                ${currentSettingsList.map((name, id) => `<strong>${id + 1})</strong> - ${name}`).join('<br>')}
                    <br>
                    ${translate('varsComandsIgnoreSettings')}`;
        case 'autoinvite':
            return `${translate('currentInviteSettings', { projectKey })}
                    <br>
                    ${currentSettingsList
                        .map(([name, userList]) => {
                            const result =
                                userList.length > 0 ? `<strong>${name})</strong>:<br> ${userList.join('<br>')}` : '';
                            return result;
                        })
                        .filter(Boolean)
                        .join('<br>')}
                    <br>
                    ${translate('varsComandsInviteSettings')}`;
    }
};

export const ignoreKeysInProject = (projectKey, namesIssueTypeInProject) => `${translate('notKeyInProject', {
    projectKey,
})}
                <br>
                ${namesIssueTypeInProject.map((name, id) => `<strong>${id + 1})</strong> - ${name}`).join('<br>')}
                `;

export const propIn = Ramda.curry((prop, arr, obj) => Ramda.or(arr, []).includes(Ramda.or(obj, {})[prop]));

export const nonEmptyString = Ramda.both(Ramda.is(String), Ramda.complement(Ramda.isEmpty));

export const getOpenedDescriptionBlock = data => [LINE_BREAKE_TAG, INDENT, data].join('');

export const getClosedDescriptionBlock = data => [getOpenedDescriptionBlock(data), LINE_BREAKE_TAG].join('');

export const timing = (startTime, now = Date.now()) => {
    const timeSync = Math.floor((now - startTime) / 1000);
    const min = Math.floor(timeSync / 60);
    const sec = timeSync % 60;
    return { min, sec };
};

export const helpPost = `
    <h5>Use "!comment" command to comment in jira issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!comment some text</strong></font><br>
        ${INDENT}text "<font color="green">some text</font>" will be shown in jira comments<br>
    <h5>Use "!assign" command to assign jira issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!assign mv_nosak</strong></font>
        or <font color="green"><strong>!assign Носак</strong></font><br>
        ${INDENT}user '<font color="green">mv_nosak</font>' will become assignee for the issue<br><br>
        ${INDENT}<font color="green"><strong>!assign</strong></font><br>
        ${INDENT}you will become assignee for the issue
    <h5>Use "!move" command to view list of available transitions<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!move</strong></font><br>
        ${INDENT}you will see a list:<br>
        ${INDENT}${INDENT}1) Done<br>
        ${INDENT}${INDENT}2) On hold<br>
        ${INDENT}Use <font color="green"><strong>"!move done"</strong></font> or
        <font color="green"><strong>"!move 1"</strong></font>
    <h5>Use "!spec" command to add watcher for issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!spec mv_nosak</strong></font>
        or <font color="green"><strong>!spec Носак</strong></font><br>
        ${INDENT}user '<font color="green">mv_nosak</font>' was added in watchers for the issue<br><br>
    <h5>Use "!prio" command to changed priority issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!prio</strong></font><br>
        ${INDENT}you will see a list:<br>
        ${INDENT}${INDENT}1) Блокирующий<br>
        ${INDENT}${INDENT}2) Критический<br>
        ${INDENT}${INDENT}3) Highest<br>
        ${INDENT}${INDENT}...<br>
        ${INDENT}${INDENT}7) Lowest<br>
        ${INDENT}Use <font color="green"><strong>"!prio Lowest"</strong></font> or
        <font color="green"><strong>"!prio 7"</strong></font>
    <h5>Use "!op" command to give moderator rights (admins only)<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!op mv_nosak</strong></font><br>
        ${INDENT}user '<font color="green">mv_nosak</font>' will become the moderator of the room<br><br>
    <h5>Use "!invite" command to invite you in room (admins only)<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!invite BBCOM-101</strong></font>
        or <font color="green"><strong>!invite #BBCOM-101:messenger.domain</strong></font><br>
        ${INDENT}Bot invite you in room for issue <font color="green">BBCOM-101</font><br><br>
    If you have administrator status, you can invite the bot into the room and he will not be denied:)
    <h5>Use "!ignore" command to add project task-types to ignore list. After that hooks form jira will be ignored.<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!ignore</strong></font>
        ${INDENT}you will see a message:<br>
        ${INDENT}Current ignore-settings for project "TCP":<br>
        ${INDENT}${INDENT}1) - Task<br>
        ${INDENT}${INDENT}2) - Epic<br>
        ${INDENT}${INDENT}3) - Bug<br>
        ${INDENT}${INDENT}...<br>
        ${INDENT}You can use comands add or del types, for example<br>
        ${INDENT}!ignore add Error<br>
        ${INDENT}!ignore del Error<br>
    <h5>Use "!create" command to create new issue in Jira and create links with current issue<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!create</strong></font><br>
        ${INDENT}you will see a message:<br>
        ${INDENT}Types of task for project "TCP":<br>
        ${INDENT}${INDENT}1) - Task<br>
        ${INDENT}${INDENT}2) - Epic<br>
        ${INDENT}${INDENT}3) - Bug<br>
        ${INDENT}${INDENT}...<br>
        ${INDENT}You can use comands with taskTypes and new name for issue<br>
        ${INDENT}<font color="green"><strong>!create</strong></font> Task My new task<br>
        ${INDENT}New link, this task relates to "New-Jira-key" "My new task"
    <h5>Use "!autoignore" command to add or del matrixUser to any room in this project and this task-type<br>
    example:</h5>
        ${INDENT}<font color="green"><strong>!autoignore</strong></font><br>
        ${INDENT}you will see a message:<br>
        ${INDENT}Current ignore-settings for project "TCP":<br>
        ${INDENT}${INDENT}1) - Task<br>
        ${INDENT}${INDENT}@user1:matrix.server.com
        ${INDENT}${INDENT}@user2:matrix.server.com
        ${INDENT}${INDENT}2) - Epic<br>
        ${INDENT}${INDENT}@user3:matrix.server.com
        ${INDENT}${INDENT}...<br>
        ${INDENT}You can use comands add or del types, for example<br>
        ${INDENT}${INDENT}!autoinvite add Error ii_ivanov
        ${INDENT}${INDENT}!autoinvite del Error ii_ivanov
    `;
