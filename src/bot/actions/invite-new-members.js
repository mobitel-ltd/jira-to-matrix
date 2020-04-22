const Ramda = require('ramda');
const conf = require('../../config');
const { errorTracing } = require('../../lib/utils.js');
const { getIssueWatchers, hasIssue } = require('../../lib/jira-request.js');
const { getAutoinviteUsers } = require('../settings');
const logger = require('../../modules/log.js')(module);

const {
    messenger: { bots },
} = conf;

module.exports = async ({ chatApi, issue }) => {
    try {
        if (!(await hasIssue(issue.key))) {
            logger.warn(`Issue by key ${issue.key} is not exists`);

            return false;
        }

        const { key, typeName, projectKey } = issue;
        const roomId = await chatApi.getRoomId(key);
        const chatRoomMembers = await chatApi.getRoomMembers({ name: key });

        const issueWatchers = await getIssueWatchers(issue);
        const issueWatchersChatIds = await Promise.all(
            issueWatchers.map(displayName => chatApi.getUserIdByDisplayName(displayName)),
        );

        const autoinviteUsers = await getAutoinviteUsers(projectKey, typeName);

        const jiraUsers = Ramda.uniq([...issueWatchersChatIds, ...autoinviteUsers]);

        const botsChatIds = bots.map(({ user }) => user).map(user => chatApi.getChatUserId(user));

        const newMembers = Ramda.difference(jiraUsers, [...chatRoomMembers, ...botsChatIds]).filter(Boolean);

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
