import * as R from 'ramda';
import { getLogger } from '../../modules/log';
import { errorTracing } from '../../lib/utils';
import { BaseAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { InviteNewMembersData, TaskTracker } from '../../types';

const logger = getLogger(module);

export class InviteNewMembers extends BaseAction<ChatFasade, TaskTracker> {
    async run({ key, typeName, projectKey }: InviteNewMembersData): Promise<string[] | false> {
        const {
            messenger: { bots },
        } = this.config;
        try {
            if (!(await this.taskTracker.hasIssue(key))) {
                logger.warn(`Issue by key ${key} is not exists`);

                return false;
            }

            const roomId = await this.chatApi.getRoomId(key);
            const chatRoomMembers = await this.chatApi.getRoomMembers({ name: key });

            const issueWatchers = await this.taskTracker.getIssueWatchers(key);
            const issueWatchersChatIds = await Promise.all(
                issueWatchers.map(({ displayName, userId }) =>
                    userId ? this.chatApi.getChatUserId(userId) : this.chatApi.getUserIdByDisplayName(displayName),
                ),
            );

            const autoinviteUsers = projectKey && typeName ? await this.getAutoinviteUsers(projectKey, typeName) : [];

            const jiraUsers = R.uniq([...issueWatchersChatIds, ...autoinviteUsers]);

            const botsChatIds = bots.map(({ user }) => user).map(user => this.chatApi.getChatUserId(user));

            const newMembers = R.difference(jiraUsers, [...chatRoomMembers, ...botsChatIds]).filter(Boolean);

            await Promise.all(
                newMembers.map(async userID => {
                    await this.chatApi.invite(roomId, userID);
                    logger.debug(`New member ${userID} invited to ${key}`);
                }),
            );

            return newMembers;
        } catch (err) {
            throw errorTracing('inviteNewMembers', err);
        }
    }
}
