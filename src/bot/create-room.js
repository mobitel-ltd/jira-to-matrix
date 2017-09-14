const jira = require('../jira')
const { helpers } = require('../matrix')
const logger = require('simple-color-logger')()

async function create(client, issue) {
    if (!client) {
        return undefined;
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
        return undefined;
    }
    logger.info(`Created room for ${issue.key}: ${response.room_id}`);
    return response.room_id;
}

// ToDo fix options for project room
async function createRoomProject(client, project) {
    if (!client) {
        return undefined;
    }

    const options = {
        room_alias_name: project.key,
        invite: [helpers.userID(project.lead.key), helpers.userID('aa_makarov')],
        name: project.name,
        topic: jira.issue.refProject(project.key),
    };

    const response = await client.createRoom(options);
    if (!response) {
        return undefined;
    }
    logger.info(`Created room for ${project.key}: ${response.room_id}`);
    return response.room_id;
}

const shouldCreateRoom = (body) => Boolean(
    typeof body === 'object'
    && typeof body.issue === 'object'
    && body.issue.key
)

const checkEpic = (body) => Boolean(
    typeof body === 'object'
    && typeof body.issue === 'object'
    && typeof body.issue.fields === 'object'
    && body.issue.fields.issuetype.name === 'Epic'
)

async function middleware(req, res, next) {
    if (shouldCreateRoom(req.body)) {
        const issue = req.body.issue;            
        logger.info(`issue: ${issue.key}`);
        const room = await req.mclient.getRoomId(issue.key);

        if (!room) {
            req.newRoomID = await create(req.mclient, issue);
        } else {
            logger.info(`The issue ${issue.key} room is already`);
        }
    } else if(req.body.webhookEvent === 'jira:issue_created') {
        req.newRoomID = await create(req.mclient, req.body.issue);
    }

    if (checkEpic(req.body)) {
        console.log('It\'s EPIC!!!');
        const projectId = req.body.issue.fields.project.id;
        const roomProject = await req.mclient.getRoomId(projectId);
        if (!roomProject) {
            const project = await jira.issue.getProject(projectId);
            const projectRoomId = createRoomProject(req.mclient, project);
            console.log(project)
        }
    }
    next();
}

module.exports.middleware = middleware;
module.exports.forTests = {shouldCreateRoom};
