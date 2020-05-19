import * as Ramda from 'ramda';
import { getLogger } from '../../modules/log';
import { errorTracing } from '../../lib/utils';
import { getAutoinviteUsers } from '../settings';
import { InviteMemberActions } from '../../types';

const logger = getLogger(module);

export const inviteNewMembers = async ({
    chatApi,
    issue,
    config,
    taskTracker,
}: InviteMemberActions): Promise<string[] | false> => {
    const {
        messenger: { bots },
    } = config;
    try {
        if (!(await taskTracker.hasIssue(issue.key))) {
            logger.warn(`Issue by key ${issue.key} is not exists`);

            return false;
        }

        const { key, typeName, projectKey } = issue;
        const roomId = await chatApi.getRoomId(key);
        const chatRoomMembers = await chatApi.getRoomMembers({ name: key });

        const issueWatchers = await taskTracker.getIssueWatchers(issue.key);
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
