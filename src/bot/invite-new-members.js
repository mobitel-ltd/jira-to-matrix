const Ramda = require('ramda');
const {getCollectParticipants} = require('../jira').issue;
const helpers = require('../matrix/helpers.js');
const logger = require('../modules/log.js')(module);

module.exports = async ({mclient, issue}) => {
    logger.debug('inviteNewMembers start');
    try {
        const collectParticipants = await getCollectParticipants(issue);
        const participants = collectParticipants.map(helpers.userID);

        const room = await mclient.getRoomByAlias(issue.key);
        if (!room) {
            throw new Error(`Matrix not return room for key ${issue.key}`);
        }

        const members = helpers.membersInvited(room.currentState.members);
        const newMembers = Ramda.difference(participants, members);
        logger.debug('Number of members to invite: ', newMembers.length);

        await Promise.all(newMembers.map(async userID => {
            await mclient.invite(room.roomId, userID);
            logger.info(`New member ${userID} invited to ${issue.key}`);
        }));

        return newMembers;
    } catch (err) {
        logger.error('error in inviteNewMembers');

        throw err;
    }
};
