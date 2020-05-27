import { translate } from '../../../locales';
import { Command, RunCommand } from './command-base';
import { CommandOptions } from '../../../types';

export class CommentCommand extends Command implements RunCommand {
    async run({ bodyText, sender, roomName }: CommandOptions) {
        if (bodyText && roomName) {
            await this.taskTracker.postComment(roomName, sender, bodyText);

            return;
        }

        return translate('emptyMatrixComment');
    }
}
