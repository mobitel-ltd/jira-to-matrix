import * as utils from '../../../lib/utils';
import { translate } from '../../../locales';
import { Command, RunCommand } from './command-base';
import { CommandOptions } from '../../../types';
import { Jira } from '../../../task-trackers/jira';

export class AssignCommand extends Command<Jira> implements RunCommand {
    async getSenderDisplayName(senderId: string): Promise<string> {
        const chatId = this.chatApi.getChatUserId(senderId);
        const userData = await this.chatApi.getUser(chatId);

        return userData!.displayName;
    }

    async run({ bodyText, sender, roomData }: CommandOptions) {
        if (!roomData.alias) {
            throw new Error('Not issue room');
        }
        try {
            const userToFind = bodyText || (await this.getSenderDisplayName(sender));
            const users = await this.taskTracker.searchUser(userToFind);

            switch (users.length) {
                case 0: {
                    return translate('errorMatrixAssign', { userToFind });
                }
                case 1: {
                    const [{ displayName, accountId }] = users;

                    await this.taskTracker.addAssignee(accountId, roomData.alias);
                    const userId = await this.chatApi.getUserIdByDisplayName(displayName);
                    await this.chatApi.invite(roomData.id, userId);

                    return translate('successMatrixAssign', { displayName });
                }
                default: {
                    return utils.getListToHTML(users);
                }
            }
        } catch (err) {
            if (typeof err === 'string') {
                if (err.includes('status is 403')) {
                    return translate('setBotToAdmin');
                }

                if (err.includes('status is 404')) {
                    return translate('noRulesToWatchIssue');
                }

                throw utils.errorTracing('Assign command', err);
            }

            throw err;
        }
    }
}
