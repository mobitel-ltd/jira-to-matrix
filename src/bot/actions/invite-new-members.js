const Ramda = require('ramda');
const conf = require('../../config');
const { errorTracing } = require('../../lib/utils.js');
const { getIssueWatchers } = require('../../lib/jira-request.js');
const { getAllSettingData } = require('../settings');
const logger = require('../../modules/log.js')(module);

module.exports = async ({ chatApi, issue }) => {
    try {
        const { key, typeName, projectKey } = issue;
        const roomId = await chatApi.getRoomId(key);
        const chatRoomMembers = await chatApi.getRoomMembers({ name: key });

        const issueWatchers = await getIssueWatchers(issue);
        const issueWatchersChatIds = issueWatchers.map(user => chatApi.getChatUserId(user));

        const { [projectKey]: currentInvite = {} } = await getAllSettingData('autoinvite');
        const { [typeName]: autoinviteUsers = [] } = currentInvite;

        const jiraUsers = Ramda.uniq([...issueWatchersChatIds, ...autoinviteUsers]);

        const {
            messenger: { bots },
        } = conf;
        const botsMatrixChatIds = bots.map(({ user }) => user).map(user => chatApi.getChatUserId(user));

        const newMembers = Ramda.difference(jiraUsers, [...chatRoomMembers, ...botsMatrixChatIds]).filter(Boolean);

        await Promise.all(
            newMembers.map(async userID => {
                await chatApi.invite(roomId, userID);
                logger.debug(`New member ${userID} invited to ${key}`);
            }),
        );

        return newMembers;
    } catch (err) {
        throw errorTracing('inviteNewMembers', err);
    }
};
