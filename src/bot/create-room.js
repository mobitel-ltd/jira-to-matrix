const jira = require('../jira');
const {helpers} = require('../matrix');
const logger = require('debug')('create room bot');

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
        logger(`Not exist matrix client. Key: ${issue.key}`);
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

const shouldCreateRoom = body => Boolean(
    typeof body === 'object'
    && typeof body.issue === 'object'
    && body.issue.key
    && body.issue_event_type_name !== 'issue_moved'
);

const checkEpic = body => Boolean(
    typeof body === 'object'
    && typeof body.issue === 'object'
    && typeof body.issue.fields === 'object'
    && body.issue.fields.issuetype.name === 'Epic'
);

const checkProjectEvent = body => Boolean(
    typeof body === 'object'
    && (
        body.webhookEvent === 'project_created'
        || body.webhookEvent === 'project_updated'
    )
);

const objHas = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const middleware = async req => {
    if (shouldCreateRoom(req.body)) {
        const {issue} = req.body;
        logger(`issue: ${issue.key}`);
        const room = await req.mclient.getRoomId(issue.key);

        if (room) {
            logger(`Room the issue ${issue.key} is already exists`);
        } else {
            logger(`Start creating the room for  issue ${issue.key}`);
            req.newRoomID = await create(req.mclient, issue);
        }
    } else if (req.body.webhookEvent === 'jira:issue_created') {
        logger(`Start creating the room for issue ${req.body.issue.key}`);
        req.newRoomID = await create(req.mclient, req.body.issue);
    }

    if (checkEpic(req.body) || checkProjectEvent(req.body)) {
        let projectOpts;
        if (objHas(req.body, 'issue') && objHas(req.body.issue, 'fields')) {
            projectOpts = req.body.issue.fields.project;
        }

        if (objHas(req.body, 'project')) {
            projectOpts = req.body.project;
        }

        if (!projectOpts) {
            logger(`Room for a project not created as projectOpts is ${projectOpts}`);
            return;
        }

        const roomProject = await req.mclient.getRoomId(projectOpts.key);

        if (roomProject) {
            logger(`Room for project ${projectOpts.key} is already exists`);
        } else {
            logger(`Try to create a room for project ${projectOpts.key}`);
            const project = await jira.issue.getProject(projectOpts.id);
            const projectRoomId = await createRoomProject(req.mclient, project);
        }
    }
};

module.exports.middleware = middleware;
module.exports.forTests = {shouldCreateRoom};
