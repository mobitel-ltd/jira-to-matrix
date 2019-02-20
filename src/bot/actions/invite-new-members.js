const Ramda = require('ramda');
const {getChatUserId, errorTracing} = require('../../lib/utils.js');
const {getIssueWatchers} = require('../../lib/jira-request.js');
const {getMembersUserId} = require('./helper.js');
const logger = require('../../modules/log.js')(module);
const {getNoRoomByAliasLog} = require('../../lib/messages');

module.exports = async ({chatApi, issue}) => {
    try {
        const room = await chatApi.getRoomByAlias(issue.key);
        if (!room) {
            throw getNoRoomByAliasLog(issue.key);
        }

        const issueWatchers = await getIssueWatchers(issue);
        const issueWatchersMatrixIds = issueWatchers.map(getChatUserId);

        const matrixRoomMembers = getMembersUserId(room.getJoinedMembers());

        const newMembers = Ramda.difference(issueWatchersMatrixIds, matrixRoomMembers);

        await Promise.all(newMembers.map(async userID => {
            await chatApi.invite(room.roomId, userID);
            logger.debug(`New member ${userID} invited to ${issue.key}`);
        }));

        return newMembers;
    } catch (err) {
        throw errorTracing('inviteNewMembers', err);
    }
};
