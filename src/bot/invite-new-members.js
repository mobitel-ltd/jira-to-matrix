const R = require('ramda');
const jira = require('../jira');
const matrix = require('../matrix');
const logger = require('simple-color-logger')();

async function inviteNew(client, issue) {
    const participants = (await jira.issue.collectParticipants(issue)).map(
        matrix.helpers.userID
    );
    const room = await client.getRoomByAlias(issue.key);
    if (!room) {
        return undefined;
    }
    const members = matrix.helpers.membersInvited(room.currentState.members);
    const newMembers = R.difference(participants, members);
    newMembers.forEach(async userID => {
        await client.invite(room.roomId, userID);
    });
    if (newMembers.length > 0) {
        logger.info(`New members invited to ${issue.key}: ${newMembers}`);
    }
    return newMembers;
}

async function middleware(req) {
    if (
        typeof req.body === 'object' &&
        req.body.webhookEvent === 'jira:issue_updated' &&
        typeof req.body.issue === 'object' &&
        req.mclient
    ) {
        await inviteNew(req.mclient, req.body.issue);
    }
}

module.exports.inviteNew = inviteNew;
module.exports.middleware = middleware;
