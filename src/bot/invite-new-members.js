const Ramda = require('ramda');
const jira = require('../jira');
const matrix = require('../matrix');
const logger = require('debug')('new member');

const inviteNew = async (client, issue) => {
    const participants = (await jira.issue.collectParticipants(issue)).map(
        matrix.helpers.userID
    );
    const room = await client.getRoomByAlias(issue.key);
    if (!room) {
        logger(`Matrix not return room for key ${issue.key}`);
        return;
    }
    const members = matrix.helpers.membersInvited(room.currentState.members);
    const newMembers = Ramda.difference(participants, members);
    newMembers.forEach(async userID => {
        await client.invite(room.roomId, userID);
    });
    if (newMembers.length > 0) {
        logger(`New members invited to ${issue.key}: ${newMembers}`);
    }
    return newMembers;
};

const middleware = async req => {
    if (
        typeof req.body === 'object' &&
        req.body.webhookEvent === 'jira:issue_updated' &&
        typeof req.body.issue === 'object' &&
        req.mclient
    ) {
        await inviteNew(req.mclient, req.body.issue);
    }
};

module.exports.inviteNew = inviteNew;
module.exports.middleware = middleware;
