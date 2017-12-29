const {issue: {getCollectParticipants, getProject, ref}} = require('../jira');
const helpers = require('../matrix/helpers.js');
const logger = require('../modules/log.js')(module);
const {postIssueDescription} = require('./');

const create = async (client, issue) => {
    try {
        const collectParticipants = await getCollectParticipants(issue);
        const participants = collectParticipants.map(helpers.userID);

        const options = {
            // eslint-disable-next-line camelcase
            room_alias_name: issue.key,
            invite: participants,
            name: helpers.composeRoomName(issue),
            topic: ref(issue.key),
        };

        const response = await client.createRoom(options);
        if (!response) {
            return;
        }
        logger.info(`Created room for ${issue.key}: ${response.room_id}`);
        return response.room_id;
    } catch (err) {
        logger.error('Error in create');

        throw err;
    }
};

const createRoomProject = async (client, project) => {
    try {
        const options = {
            // eslint-disable-next-line camelcase
            room_alias_name: project.key,
            invite: [helpers.userID(project.lead.key)],
            name: project.name,
            topic: ref(project.key, 'projects'),
        };

        const response = await client.createRoom(options);
        if (!response) {
            return;
        }
        logger.info(`Created room for project ${project.key}: ${response.room_id}`);
        return response.room_id;
    } catch (err) {
        logger.error('createRoomProject Error');

        throw err;
    }
};

module.exports = async ({mclient, issue, webhookEvent, projectOpts}) => {
    logger.info('room creating');
    try {
        if (!mclient) {
            logger.error(`Not exist matrix client. Key: ${issue.key}`);

            throw 'No Matrix client';
        }

        const room = await mclient.getRoomId(issue.key);

        if (webhookEvent === 'jira:issue_created' || !room) {
            logger.debug(`Start creating the room for  issue ${issue.key}`);
            const newRoomID = await create(mclient, issue);
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

        return false;
    }
};
