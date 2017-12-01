const Ramda = require('ramda');
const jira = require('../jira');
const matrix = require('../matrix');
const logger = require('debug')('new member');

const inviteNewMembers = async ({mclient, issue}) => {
    logger('inviteNewMembers start');
    try {
        const participants = (await jira.issue.collectParticipants(issue))
            .map(matrix.helpers.userID);

        const room = await mclient.getRoomByAlias(issue.key);
        if (!room) {
            throw new Error(`Matrix not return room for key ${issue.key}`);
        }

        const members = matrix.helpers.membersInvited(room.currentState.members);
        const newMembers = Ramda.difference(participants, members);
        logger('Number of members to invite: ', newMembers.length);

        newMembers.forEach(async userID => {
            await mclient.invite(room.roomId, userID);
        });

        if (newMembers.length > 0) {
            logger(`New members invited to ${issue.key}: ${newMembers}`);
        }

        return newMembers;
    } catch (err) {
        logger('error in inviteNewMembers', err);
        return false;
    }
};

module.exports = {inviteNewMembers};
