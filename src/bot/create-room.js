const jira = require('../jira');
const {helpers} = require('../matrix');
const logger = require('debug')('create room bot');
const {postIssueDescription} = require('./');

const create = async (client, issue) => {
    if (!client) {
        logger(`Not exist matrix client. Key: ${issue.key}`);
        return;
    }
    const participants = (await jira.issue.collectParticipants(issue)).map(
        helpers.userID
    );

    const options = {
        room_alias_name: issue.key,
        invite: participants,
        name: helpers.composeRoomName(issue),
        topic: jira.issue.ref(issue.key),
    };

    const response = await client.createRoom(options);
    if (!response) {
        return;
    }
    logger(`Created room for ${issue.key}: ${response.room_id}`);
    return response.room_id;
};

const createRoomProject = async (client, project) => {
    if (!client) {
        logger(`Not exist matrix client. Project: ${project}`);
        return;
    }

    const options = {
        room_alias_name: project.key,
        invite: [helpers.userID(project.lead.key)],
        name: project.name,
        topic: jira.issue.refProject(project.key),
    };

    const response = await client.createRoom(options);
    if (!response) {
        return;
    }
    logger(`Created room for project ${project.key}: ${response.room_id}`);
    return response.room_id;
};

const createRoom = async ({mclient, issue, webhookEvent, projectOpts}) => {
    logger('room creating');
    try {
        const room = await mclient.getRoomId(issue.key);

        let newRoomID;
        if (room) {
            logger(`Room the issue ${issue.key} is already exists`);
        } else {
            logger(`Start creating the room for  issue ${issue.key}`);
            newRoomID = await create(mclient, issue);
        }

        if (webhookEvent === 'jira:issue_created') {
            logger(`Start creating the room for issue ${issue.key}`);
            newRoomID = await create(mclient, issue);
        } else {
            logger('room should not be created');
        }

        if (newRoomID && mclient) {
            await postIssueDescription({mclient, issue, newRoomID});
        }

        if (!projectOpts) {
            logger(`Room for a project not created as projectOpts is ${projectOpts}`);
            return true;
        }

        const roomProject = await mclient.getRoomId(projectOpts.key);
        logger(roomProject);

        if (roomProject) {
            logger(`Room for project ${projectOpts.key} is already exists`);
        } else {
            logger(`Try to create a room for project ${projectOpts.key}`);
            const project = await jira.issue.getProject(projectOpts.id);
            await createRoomProject(mclient, project);
        }
        return true;
    } catch (err) {
        logger('error in room creating');
        return false;
    }
};

module.exports = {createRoom};
