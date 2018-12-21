const Ramda = require('ramda');
const {getMatrixUserID, errorTracing} = require('../lib/utils.js');
const {getRoomMembers} = require('../lib/jira-request.js');
const {membersInvited} = require('./helper.js');
const logger = require('../modules/log.js')(module);
const {getNoRoomByAliasLog} = require('../../src/lib/messages');

module.exports = async ({mclient, issue}) => {
    try {
        const roomMembers = await getRoomMembers(issue);
        const roomMemebersUerId = roomMembers.map(getMatrixUserID);

        const room = await mclient.getRoomByAlias(issue.key);
        if (!room) {
            throw getNoRoomByAliasLog(issue.key);
        }

        const members = membersInvited(room.getJoinedMembers());
        const newMembers = Ramda.difference(roomMemebersUerId, members);

        await Promise.all(newMembers.map(async userID => {
            await mclient.invite(room.roomId, userID);
            logger.debug(`New member ${userID} invited to ${issue.key}`);
        }));

        return newMembers;
    } catch (err) {
        throw errorTracing('inviteNewMembers', err);
    }
};
