import { translate } from '../../../locales';
import * as utils from '../../../lib/utils';
import { Command, RunCommand } from './command-base';
import { CommandOptions } from '../../../types';
import { Jira } from '../../../task-trackers/jira';

export class SpecCommand extends Command<Jira> implements RunCommand {
    async run({ bodyText, roomId, roomName }: CommandOptions) {
        if (!roomName) {
            throw new Error('Not issue room');
        }
        if (!bodyText) {
            return translate('emptyBodyText');
        }

        try {
            const users = await this.taskTracker.searchUser(bodyText);
            switch (users.length) {
                case 0: {
                    return translate('errorWatcherJira');
                }
                case 1: {
                    const [{ displayName, accountId }] = users;

                    await this.taskTracker.addWatcher(accountId, roomName);
                    const userId = await this.chatApi.getUserIdByDisplayName(displayName);
                    await this.chatApi.invite(roomId, userId);

                    return translate('successWatcherJira');
                }
                default: {
                    return utils.getListToHTML(users);
                }
            }
        } catch (err) {
            if (err.includes) {
                if (err.includes('status is 403')) {
                    const projectKey = utils.getProjectKeyFromIssueKey(roomName);
                    const viewUrl = this.taskTracker.getViewUrl(projectKey);
                    return translate('setBotToAdmin', { projectKey, viewUrl });
                }

                if (err.includes('status is 404')) {
                    return translate('noRulesToWatchIssue');
                }
            }

            throw utils.errorTracing('Spec command', err);
        }
    }
}
