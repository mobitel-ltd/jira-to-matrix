const jiraRequest = require('../../lib/jira-request.js');
const utils = require('../../lib/utils.js');
const logger = require('../../modules/log.js')(module);
const {getDescription} = require('./helper');
const {infoBody} = require('../../lib/messages');

const getRoomId = async (chatApi, key) => {
    try {
        const id = await chatApi.getRoomId(key);
        logger.debug(`Room should not be created, roomId is ${id} for room ${key}`);

        return id;
    } catch (err) {
        return false;
    }
};

const createIssueRoom = async (chatApi, issue) => {
    try {
        const roomMembers = await jiraRequest.getIssueWatchers(issue);
        const invite = roomMembers.map(utils.getChatUserId);

        const {key} = issue;
        const name = utils.composeRoomName(issue.key, issue.summary);
        const topic = utils.getViewUrl(key);

        const options = {
            'room_alias_name': key,
            invite,
            name,
            topic,
            'purpose': issue.summary,
        };

        const roomId = await chatApi.createRoom(options);

        logger.info(`Created room for ${key}: ${roomId}`);
        const {body, htmlBody} = await getDescription(issue);

        await chatApi.sendHtmlMessage(roomId, body, htmlBody);
        await chatApi.sendHtmlMessage(roomId, infoBody, infoBody);
    } catch (err) {
        throw utils.errorTracing('createIssueRoom', err);
    }
};

const createProjectRoom = async (chatApi, projectKey) => {
    try {
        const {lead, name: projectName} = await jiraRequest.getProject(projectKey);
        const name = utils.composeRoomName(projectKey, projectName);
        const invite = [utils.getChatUserId(lead.key)];
        const topic = utils.getViewUrl(projectKey);

        const options = {
            'room_alias_name': projectKey,
            invite,
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
    const issueBody = await jiraRequest.getIssueSafety(issueData.id);
    if (!issueBody) {
        return issueData;
    }

    return {
        ...issueData,
        key: utils.getKey(issueBody),
        roomMembers: utils.getMembers(issueBody),
        summary: utils.getSummary(issueBody),
    };
};

/**
 * post issue update
 * @param  {object} options options
 * @param  {object} options.chatApi messenger client instance
 * @param  {object} options.issue parsed webhook issue data
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
module.exports = async ({chatApi, issue, projectKey}) => {
    try {
        const checkedIssue = issue.key ? issue : await getCheckedIssue(issue);

        if (checkedIssue.key) {
            await getRoomId(chatApi, checkedIssue.key) || await createIssueRoom(chatApi, checkedIssue);
        }
        if (projectKey) {
            await getRoomId(chatApi, projectKey) || await createProjectRoom(chatApi, projectKey);
        }

        return true;
    } catch (err) {
        throw utils.errorTracing('create room', err);
    }
};
