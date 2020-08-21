import { translate } from '../../../locales';
import { Command, RunCommand } from './command-base';
import { CommandOptions, TaskTracker } from '../../../types';
import { getLogger } from '../../../modules/log';

const logger = getLogger(module);

export class CommentCommand extends Command<TaskTracker> implements RunCommand {
    async run({ bodyText, sender, roomName, senderDisplayName }: CommandOptions) {
        try {
            if (bodyText && roomName) {
                await this.taskTracker.postComment(roomName, { sender, senderDisplayName }, bodyText);

                return;
            }

            return translate('emptyBodyText');
        } catch (error) {
            logger.error('Comment command error');
            logger.error(error);

            //return translate('errorCommentSend');
            return error;
        }
    }
}
