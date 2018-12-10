const {getRoomMembers, getProject, getProjectUrl} = require('../lib/jira-request.js');
const {getUserID} = require('./helper.js');
const {composeRoomName} = require('../lib/utils.js');
const logger = require('../modules/log.js')(module);
const postIssueDescription = require('./post-issue-description.js');

const create = async (client, issue) => {
    try {
        const roomMembers = await getRoomMembers(issue);
        const invite = roomMembers.map(getUserID);

        const {key} = issue;
        const name = composeRoomName(issue);
        const topic = getProjectUrl(key);

        const options = {
            'room_alias_name': key,
            invite,
            name,
            topic,
        };

        const roomId = await client.createRoom(options);

        logger.info(`Created room for ${key}: ${roomId}`);
        return roomId;
    } catch (err) {
        throw ['Error in room create', err].join('\n');
    }
};

const createRoomProject = async (client, {key, lead, name}) => {
    try {
        const invite = [getUserID(lead.key)];
        const topic = getProjectUrl(key, 'projects');

        const options = {
            'room_alias_name': key,
            invite,
            name,
            topic,
        };

        const roomId = await client.createRoom(options);

        logger.info(`Created room for project ${key}: ${roomId}`);
        return roomId;
    } catch (err) {
        throw ['createRoomProject Error', err].join('\n');
    }
};

module.exports = async ({mclient, issue, webhookEvent, projectOpts}) => {
    try {
        const roomID = await mclient.getRoomId(issue.key);
        if (roomID) {
            logger.debug(`Room should not be created, roomId is ${roomID} for room ${issue.key}`);
        } else {
            const newRoomID = await create(mclient, issue);
            await postIssueDescription({mclient, issue, newRoomID});
        }
        if (!projectOpts) {
            return true;
        }

        const roomProject = await mclient.getRoomId(projectOpts.key);

        if (roomProject) {
            logger.debug(`Room for project ${projectOpts.key} is already exists`);
        } else {
            const project = await getProject(projectOpts.id);
            await createRoomProject(mclient, project);
        }
        return true;
    } catch (err) {
        throw ['Error in room creating', err].join('\n');
    }
};
