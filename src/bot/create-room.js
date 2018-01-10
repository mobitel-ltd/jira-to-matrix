const {getCollectParticipants, getProject, getProjectUrl} = require('../jira').issue;
const {composeRoomName, getUserID} = require('./helper.js');
const logger = require('../modules/log.js')(module);
const postIssueDescription = require('./post-issue-description.js');

const create = async (client, issue) => {
    try {
        const collectParticipants = await getCollectParticipants(issue);
        const invite = collectParticipants.map(getUserID);

        const {key} = issue;
        const name = composeRoomName(issue);
        const topic = getProjectUrl(key);

        const options = {
            // eslint-disable-next-line camelcase
            room_alias_name: key,
            invite,
            name,
            topic,
        };
        logger.debug('options', options);

        const roomId = await client.createRoom(options);

        logger.info(`Created room for ${key}: ${roomId}`);
        return roomId;
    } catch (err) {
        logger.error('Error in room create');

        throw err;
    }
};

const createRoomProject = async (client, {key, lead, name}) => {
    try {
        const invite = [getUserID(lead.key)];
        const topic = getProjectUrl(key, 'projects');

        const options = {
            // eslint-disable-next-line camelcase
            room_alias_name: key,
            invite,
            name,
            topic,
        };

        const roomId = await client.createRoom(options);

        logger.info(`Created room for project ${key}: ${roomId}`);
        return roomId;
    } catch (err) {
        logger.error('createRoomProject Error');

        throw err;
    }
};

module.exports = async ({mclient, issue, webhookEvent, projectOpts}) => {
    logger.debug('Room creating');
    try {
        const roomID = await mclient.getRoomId(issue.key);

        if (webhookEvent === 'jira:issue_created' || !roomID) {
            logger.debug(`Start creating the room for issue ${issue.key}`);

            const newRoomID = await create(mclient, issue);
            logger.debug('postIssueDescription', postIssueDescription);
            await postIssueDescription({mclient, issue, newRoomID});
        } else {
            logger.debug('Room should not be created');
        }

        if (!projectOpts) {
            logger.debug(`Room for a project not created as projectOpts is ${projectOpts}`);
            return true;
        }

        const roomProject = await mclient.getRoomId(projectOpts.key);

        if (roomProject) {
            logger.debug(`Room for project ${projectOpts.key} is already exists`);
        } else {
            logger.debug(`Try to create a room for project ${projectOpts.key}`);
            const project = await getProject(projectOpts.id);
            await createRoomProject(mclient, project);
        }
        return true;
    } catch (err) {
        logger.error('Error in room creating');

        throw err;
    }
};
