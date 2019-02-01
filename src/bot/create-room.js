const {getIssueWatchers, getProject} = require('../lib/jira-request.js');
const {composeRoomName, getViewUrl, errorTracing, getMatrixUserID} = require('../lib/utils.js');
const logger = require('../modules/log.js')(module);
const {getDescription} = require('./helper');
const {infoBody} = require('../lib/messages');

const getRoomId = async (mclient, key) => {
    try {
        const id = await mclient.getRoomId(key);
        logger.debug(`Room should not be created, roomId is ${id} for room ${key}`);

        return id;
    } catch (err) {
        return false;
    }
};

const createIssueRoom = async (mclient, issue) => {
    try {
        const roomMembers = await getIssueWatchers(issue);
        const invite = roomMembers.map(getMatrixUserID);

        const {key} = issue;
        const name = composeRoomName(issue);
        const topic = getViewUrl(key);

        const options = {
            'room_alias_name': key,
            invite,
            name,
            topic,
        };

        const roomId = await mclient.createRoom(options);

        logger.info(`Created room for ${key}: ${roomId}`);
        const {body, htmlBody} = await getDescription(issue);

        await mclient.sendHtmlMessage(roomId, body, htmlBody);
        await mclient.sendHtmlMessage(roomId, infoBody, infoBody);
    } catch (err) {
        throw errorTracing('createIssueRoom', err);
    }
};

const createProjectRoom = async (mclient, projectKey) => {
    try {
        const {lead, name} = await getProject(projectKey);
        const invite = [getMatrixUserID(lead.key)];
        const topic = getViewUrl(projectKey);

        const options = {
            'room_alias_name': projectKey,
            invite,
            name,
            topic,
        };

        const roomId = await mclient.createRoom(options);
        logger.info(`Created room for project ${projectKey}: ${roomId}`);
    } catch (err) {
        throw errorTracing('createProjectRoom', err);
    }
};

module.exports = async ({mclient, issue, projectKey}) => {
    try {
        if (issue.key) {
            await getRoomId(mclient, issue.key) || await createIssueRoom(mclient, issue);
        }
        if (projectKey) {
            await getRoomId(mclient, projectKey) || await createProjectRoom(mclient, projectKey);
        }

        return true;
    } catch (err) {
        throw errorTracing('create room', err);
    }
};
