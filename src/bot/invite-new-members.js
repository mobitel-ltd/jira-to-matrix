const Ramda = require('ramda');
const {getCollectParticipants} = require('../jira').issue;
const {getUserID, membersInvited} = require('./helper.js');
const logger = require('../modules/log.js')(module);

module.exports = async ({mclient, issue}) => {
    logger.debug('inviteNewMembers start');
    try {
        const collectParticipants = await getCollectParticipants(issue);
        const participants = collectParticipants.map(getUserID);

        const room = await mclient.getRoomByAlias(issue.key);
        if (!room) {
            logger.warn(`Matrix not return room for key ${issue.key} in inviteNewMembers`);
            return;
        }

        const members = membersInvited(room.getJoinedMembers());
        const newMembers = Ramda.difference(participants, members);
        logger.debug('Number of members to invite: ', newMembers.length);

        await Promise.all(newMembers.map(async userID => {
            await mclient.invite(room.roomId, userID);
            logger.debug(`New member ${userID} invited to ${issue.key}`);
        }));

        return newMembers;
    } catch (err) {
        throw ['Error in inviteNewMembers', err].join('\n');
    }
};
