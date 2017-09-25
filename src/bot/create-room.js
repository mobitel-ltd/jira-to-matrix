const jira = require('../jira');
const { helpers } = require('../matrix');
const logger = require('simple-color-logger')();

async function create(client, issue) {
    if (!client) {
        logger.info(`Not exist matrix client. Key: ${issue.key}`);
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
    logger.info(`Created room for ${issue.key}: ${response.room_id}`);
    return response.room_id;
}

async function createRoomProject(client, project) {
    if (!client) {
        logger.info(`Not exist matrix client. Key: ${issue.key}`);
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
    logger.info(`Created room for project ${project.key}: ${response.room_id}`);
    return response.room_id;
}

const shouldCreateRoom = (body) => Boolean(
    typeof body === 'object'
    && typeof body.issue === 'object'
    && body.issue.key
    && body.issue_event_type_name !== 'issue_moved'
)

const checkEpic = (body) => Boolean(
    typeof body === 'object'
    && typeof body.issue === 'object'
    && typeof body.issue.fields === 'object'
    && body.issue.fields.issuetype.name === 'Epic'
)

const checkProjectEvent = (body) => Boolean(
    typeof body === 'object'
    && (
        body.webhookEvent === 'project_created'
        || body.webhookEvent === 'project_updated'
    )
)


async function middleware(req) {
    if (shouldCreateRoom(req.body)) {
        const issue = req.body.issue;            
        logger.info(`issue: ${issue.key}`);
        const room = await req.mclient.getRoomId(issue.key);

        if (!room) {
            logger.info(`Start creating the room for  issue ${issue.key}`);
            req.newRoomID = await create(req.mclient, issue);
        } else {
            logger.info(`Room the issue ${issue.key} is already exists`);
        }
    } else if(req.body.webhookEvent === 'jira:issue_created') {
        logger.info(`Start creating the room for issue ${issue.key}`);
        req.newRoomID = await create(req.mclient, req.body.issue);
    }

    if (checkEpic(req.body) || checkProjectEvent(req.body)) {
        const projectOpts = req.body.issue.fields.project;
        const roomProject = await req.mclient.getRoomId(projectOpts.key);
        
        if (!roomProject) {
            logger.info(`Try to create a room for project ${projectOpts.key}`);
            const project = await jira.issue.getProject(projectOpts.id);
            const projectRoomId = await createRoomProject(req.mclient, project);
        } else {
            logger.info(`Room for project ${projectOpts.key} is already exists`);
        }
    }
}

module.exports.middleware = middleware;
module.exports.forTests = {shouldCreateRoom};
