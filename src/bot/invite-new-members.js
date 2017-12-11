const Ramda = require('ramda');
const jira = require('../jira');
const helpers = require('../matrix/helpers.js');
const logger = require('../modules/log.js')(module);

const inviteNewMembers = async ({mclient, issue}) => {
    logger.debug('inviteNewMembers start');
    try {
        const participants = (await jira.issue.collectParticipants(issue))
            .map(helpers.userID);

        const room = await mclient.getRoomByAlias(issue.key);
        if (!room) {
            throw new Error(`Matrix not return room for key ${issue.key}`);
        }

        const members = helpers.membersInvited(room.currentState.members);
        const newMembers = Ramda.difference(participants, members);
        logger.debug('Number of members to invite: ', newMembers.length);

        await Promise.all(newMembers.map(async userID => {
            await mclient.invite(room.roomId, userID);
        }));

        if (newMembers.length > 0) {
            logger.info(`New members invited to ${issue.key}: ${newMembers}`);
        }

        return newMembers;
    } catch (err) {
        logger.error('error in inviteNewMembers');
        throw err;
    }
};

module.exports = {inviteNewMembers};
