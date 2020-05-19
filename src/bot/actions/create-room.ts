import { fromString } from 'html-to-text';
import * as marked from 'marked';
import { getLogger } from '../../modules/log';
import { translate } from '../../locales';
import * as utils from '../../lib/utils';
import { getDefaultAvatarLink } from './helper';
import { getAutoinviteUsers } from '../settings';
import { infoBody } from '../../lib/messages';
import { CreateRoomActions, TaskTracker, Issue } from '../../types';

const logger = getLogger(module);

// eslint-disable-next-line
const getEpicInfo = epicLink =>
    epicLink === translate('miss')
        ? ''
        : `            <br>Epic link:
                ${utils.getOpenedDescriptionBlock(epicLink)}
                ${utils.getClosedDescriptionBlock(utils.getViewUrl(epicLink))}`;

const getPost = body => {
    const post = `
            Assignee:
                ${utils.getOpenedDescriptionBlock(body.assigneeName)}
            <br>Reporter:
                ${utils.getOpenedDescriptionBlock(body.reporterName)}
            <br>Type:
                ${utils.getClosedDescriptionBlock(body.typeName)}
            <br>Estimate time:
                ${utils.getClosedDescriptionBlock(body.estimateTime)}
            <br>Description:
                ${utils.getClosedDescriptionBlock(marked(body.description))}
            <br>Priority:
                ${utils.getClosedDescriptionBlock(body.priority)}`;

    const epicInfo = getEpicInfo(body.epicLink);

    return [post, epicInfo].join('\n');
};

export const getDescription = async (
    issue: Issue,
    taskTracker: TaskTracker,
): Promise<{ body: string; htmlBody: string }> => {
    try {
        const { description } = await taskTracker.getRenderedValues(issue.key, ['description']);
        const handleBody = description ? { ...issue.descriptionFields, description } : issue.descriptionFields;
        const htmlBody = getPost(handleBody);
        const body = fromString(htmlBody);

        return { body, htmlBody };
    } catch (err) {
        throw utils.errorTracing('getDescription', err);
    }
};

const createIssueRoom = async (chatApi, issue, config, taskTracker): Promise<void> => {
    try {
        const { colors } = config;
        const {
            key,
            summary,
            projectKey,
            descriptionFields: { typeName },
        } = issue;

        const autoinviteUsers = await getAutoinviteUsers(projectKey, typeName);

        const issueWatchers = await taskTracker.getIssueWatchers(issue.key);
        const issueWatchersChatIds = await Promise.all(
            issueWatchers.map(displayName => chatApi.getUserIdByDisplayName(displayName)),
        );

        const invite = [...issueWatchersChatIds, ...autoinviteUsers];

        const name = chatApi.composeRoomName(key, summary);
        const topic = utils.getViewUrl(key);

        const avatarUrl = getDefaultAvatarLink(key, 'issue', colors);

        const options = {
            room_alias_name: key,
            invite,
            name,
            topic,
            purpose: summary,
            avatarUrl,
        };

        const roomId = await chatApi.createRoom(options);

        logger.info(`Created room for ${key}: ${roomId}`);
        const { body, htmlBody } = await getDescription(issue, taskTracker);

        await chatApi.sendHtmlMessage(roomId, body, htmlBody);
        await chatApi.sendHtmlMessage(roomId, infoBody, infoBody);
    } catch (err) {
        throw utils.errorTracing('createIssueRoom', err);
    }
};

const createProjectRoom = async (chatApi, projectKey, taskTracker) => {
    try {
        const { lead, name: projectName } = await taskTracker.getProject(projectKey);
        const name = chatApi.composeRoomName(projectKey, projectName);
        const leadUserId = await chatApi.getUserIdByDisplayName(lead);
        const topic = utils.getViewUrl(projectKey);

        const options = {
            room_alias_name: projectKey,
            invite: [leadUserId],
            name,
            topic,
        };

        const roomId = await chatApi.createRoom(options);
        logger.info(`Created room for project ${projectKey}: ${roomId}`);
    } catch (err) {
        throw utils.errorTracing('createProjectRoom', err);
    }
};

const getCheckedIssue = async (issueData, taskTracker) => {
    const issueBody = await taskTracker.getIssueSafety(issueData.key || issueData.id);
    if (!issueBody) {
        return issueData;
    }

    return {
        ...issueData,
        key: utils.getKey(issueBody),
        roomMembers: utils.getMembers(issueBody),
        summary: utils.getSummary(issueBody),
        descriptionFields: utils.getDescriptionFields(issueBody),
    };
};

const hasData = issue => issue.key && issue.summary;

/**
 * post issue update
 * @param  {object} options options
 * @param  {object} options.chatApi messenger client instance
 * @param  {object?} options.issue parsed webhook issue data
 * @param  {string} options.issue.id issue id
 * @param  {string?} options.issue.key issue key
 * @param  {string[]|undefined} options.issue.roomMembers issue roomMembers incudes author and assignee
 * @param  {string?} options.issue.summary issue summary
 * @param  {object} options.issue.descriptionFields issue descriptionFields
 * @param  {string} options.newKey new key of issue
 * @param  {string} options.newName new name of room
 * @param  {object} options.changelog changes object
 * @param  {string?} options.projectKey changes author
 */
export const createRoom = async ({ chatApi, issue, projectKey, config, taskTracker }: CreateRoomActions) => {
    try {
        const keyOrId = issue.key || issue.id;
        if (issue && keyOrId) {
            if (!(await taskTracker.hasIssue(keyOrId))) {
                logger.warn(`Issue ${keyOrId} is not exists`);

                return false;
            }
            const checkedIssue = hasData(issue) ? issue : await getCheckedIssue(issue, taskTracker);

            (await chatApi.getRoomIdByName(checkedIssue.key)) ||
                (await createIssueRoom(chatApi, checkedIssue, config, taskTracker));
        }
        if (projectKey) {
            (await chatApi.getRoomIdByName(projectKey)) || (await createProjectRoom(chatApi, projectKey, taskTracker));
        }

        return true;
    } catch (err) {
        throw utils.errorTracing('create room', err);
    }
};
