import * as Ramda from 'ramda';
import { getLogger } from '../../modules/log';
import { errorTracing } from '../../lib/utils';
import { getAutoinviteUsers } from '../settings';
import { BaseAction, RunAction } from './base-action';
import { ChatFasade } from '../../messengers/chat-fasade';
import { InviteNewMembersData, TaskTracker } from '../../types';

const logger = getLogger(module);

export class InviteNewMembers extends BaseAction<ChatFasade, TaskTracker> implements RunAction {
    async run({ issue }: InviteNewMembersData): Promise<string[] | false> {
        const {
            messenger: { bots },
        } = this.config;
        try {
            if (!(await this.taskTracker.hasIssue(issue.key))) {
                logger.warn(`Issue by key ${issue.key} is not exists`);

                return false;
            }

            const { key, typeName, projectKey } = issue;
            const roomId = await this.chatApi.getRoomId(key);
            const chatRoomMembers = await this.chatApi.getRoomMembers({ name: key });

            const issueWatchers = await this.taskTracker.getIssueWatchers(issue.key);
            const issueWatchersChatIds = await Promise.all(
                issueWatchers.map(displayName => this.chatApi.getUserIdByDisplayName(displayName)),
            );

            const autoinviteUsers = await getAutoinviteUsers(projectKey, typeName);

            const jiraUsers = Ramda.uniq([...issueWatchersChatIds, ...autoinviteUsers]);

            const botsChatIds = bots.map(({ user }) => user).map(user => this.chatApi.getChatUserId(user));

            const newMembers = Ramda.difference(jiraUsers, [...chatRoomMembers, ...botsChatIds]).filter(Boolean);

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
