const jiraRequest = require('../../lib/jira-request.js');
const {composeRoomName, getViewUrl, errorTracing, getChatUserId} = require('../../lib/utils.js');
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
        const invite = roomMembers.map(getChatUserId);

        const {key} = issue;
        const name = composeRoomName(issue);
        const topic = getViewUrl(key);

        const options = {
            'room_alias_name': key,
            invite,
            name,
            topic,
        };

        const roomId = await chatApi.createRoom(options);

        logger.info(`Created room for ${key}: ${roomId}`);
        const {body, htmlBody} = await getDescription(issue);

        await chatApi.sendHtmlMessage(roomId, body, htmlBody);
        await chatApi.sendHtmlMessage(roomId, infoBody, infoBody);
    } catch (err) {
        throw errorTracing('createIssueRoom', err);
    }
};

const createProjectRoom = async (chatApi, projectKey) => {
    try {
        const {lead, name} = await jiraRequest.getProject(projectKey);
        const invite = [getChatUserId(lead.key)];
        const topic = getViewUrl(projectKey);

        const options = {
            'room_alias_name': projectKey,
            invite,
            name,
            topic,
        };

        const roomId = await chatApi.createRoom(options);
        logger.info(`Created room for project ${projectKey}: ${roomId}`);
    } catch (err) {
        throw errorTracing('createProjectRoom', err);
    }
};

const getKey = async id => {
    const issue = await jiraRequest.getIssueSafety(id);

    return issue && issue.key;
};

module.exports = async ({chatApi, issue, projectKey}) => {
    try {
        const key = issue.key || await getKey(issue.id);
        if (key) {
            await getRoomId(chatApi, key) || await createIssueRoom(chatApi, {...issue, key});
        }
        if (projectKey) {
            await getRoomId(chatApi, projectKey) || await createProjectRoom(chatApi, projectKey);
        }

        return true;
    } catch (err) {
        throw errorTracing('create room', err);
    }
};
