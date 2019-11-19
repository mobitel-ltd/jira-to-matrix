const Ramda = require('ramda');
const conf = require('../../config');
const { errorTracing } = require('../../lib/utils.js');
const { getIssueWatchers } = require('../../lib/jira-request.js');
const logger = require('../../modules/log.js')(module);

module.exports = async ({ chatApi, issue }) => {
    try {
        const roomId = await chatApi.getRoomId(issue.key);
        const chatRoomMembers = await chatApi.getRoomMembers({ name: issue.key });

        const issueWatchers = await getIssueWatchers(issue);
        const issueWatchersChatIds = issueWatchers.map(user => chatApi.getChatUserId(user));

        const {
            messenger: { bots },
        } = conf;

        const newMembers = Ramda.difference(issueWatchersChatIds, [...chatRoomMembers, ...bots]).filter(Boolean);

        await Promise.all(
            newMembers.map(async userID => {
                await chatApi.invite(roomId, userID);
                logger.debug(`New member ${userID} invited to ${issue.key}`);
            }),
        );

        return newMembers;
    } catch (err) {
        throw errorTracing('inviteNewMembers', err);
    }
};
