const Ramda = require('ramda');
const {getRoomMembers} = require('../lib/jira-request.js');
const {getUserID, membersInvited} = require('./helper.js');
const logger = require('../modules/log.js')(module);

module.exports = async ({mclient, issue}) => {
    logger.debug('inviteNewMembers start');
    try {
        const roomMembers = await getRoomMembers(issue);
        const participants = roomMembers.map(getUserID);

        const room = await mclient.getRoomByAlias(issue.key);
        if (!room) {
            throw `Matrix not return room for key ${issue.key} in inviteNewMembers`;
        }

        const members = membersInvited(room.getJoinedMembers());
        const newMembers = Ramda.difference(participants, members);

        await Promise.all(newMembers.map(async userID => {
            await mclient.invite(room.roomId, userID);
            logger.debug(`New member ${userID} invited to ${issue.key}`);
        }));

        return newMembers;
    } catch (err) {
        throw ['Error in inviteNewMembers', err].join('\n');
    }
};
