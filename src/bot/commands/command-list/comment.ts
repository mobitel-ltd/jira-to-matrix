import { translate } from '../../../locales';
import { Command, RunCommand } from './command-base';
import { CommandOptions, TaskTracker } from '../../../types';

export class CommentCommand extends Command<TaskTracker> implements RunCommand {
    async run({ bodyText, sender, roomName, senderDisplayName }: CommandOptions) {
        if (bodyText && roomName) {
            await this.taskTracker.postComment(roomName, { sender, senderDisplayName }, bodyText);

            return;
        }

        return translate('emptyBodyText');
    }
}
