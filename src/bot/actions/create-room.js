const jiraRequest = require('../../lib/jira-request.js');
const conf = require('../../config');
const utils = require('../../lib/utils.js');
const logger = require('../../modules/log.js')(module);
const { getDescription, getDefaultAvatarLink } = require('./helper');
const { getAutoinviteUsers } = require('../settings');
const { infoBody } = require('../../lib/messages');

const createIssueRoom = async (chatApi, issue) => {
    try {
        const { colors } = conf;
        const {
            key,
            summary,
            projectKey,
            descriptionFields: { typeName },
        } = issue;

        const autoinviteUsers = await getAutoinviteUsers(projectKey, typeName);

        const issueWatchers = await jiraRequest.getIssueWatchers(issue);
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
        const { body, htmlBody } = await getDescription(issue);

        await chatApi.sendHtmlMessage(roomId, body, htmlBody);
        await chatApi.sendHtmlMessage(roomId, infoBody, infoBody);
    } catch (err) {
        throw utils.errorTracing('createIssueRoom', err);
    }
};

const createProjectRoom = async (chatApi, projectKey) => {
    try {
        const { lead, name: projectName } = await jiraRequest.getProject(projectKey);
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

const getCheckedIssue = async issueData => {
    const issueBody = await jiraRequest.getIssueSafety(issueData.key || issueData.id);
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
module.exports = async ({ chatApi, issue, projectKey }) => {
    try {
        if (issue && (issue.key || issue.id)) {
            const checkedIssue = hasData(issue) ? issue : await getCheckedIssue(issue);

            (await chatApi.getRoomIdByName(checkedIssue.key)) || (await createIssueRoom(chatApi, checkedIssue));
        }
        if (projectKey) {
            (await chatApi.getRoomIdByName(projectKey)) || (await createProjectRoom(chatApi, projectKey));
        }

        return true;
    } catch (err) {
        throw utils.errorTracing('create room', err);
    }
};
