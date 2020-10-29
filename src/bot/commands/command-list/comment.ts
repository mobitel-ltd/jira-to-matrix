import { translate } from '../../../locales';
import { Command, RunCommand } from './command-base';
import { CommandOptions, TaskTracker } from '../../../types';
import { getLogger } from '../../../modules/log';

const logger = getLogger(module);

export class CommentCommand extends Command<TaskTracker> implements RunCommand {
    async run({ bodyText, sender, roomName, senderDisplayName }: CommandOptions) {
        try {
            if (bodyText && roomName) {
                if (!this.taskTracker.selectors.isIssueRoomName(roomName)) {
                    logger.warn('Skip commenting in not issue room ' + roomName);
                    return;
                }
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
