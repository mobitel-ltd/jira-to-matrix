import { translate } from '../../../locales';
import { Command, RunCommand } from './command-base';
import { CommandOptions, TaskTracker } from '../../../types';

export class AliveCommand extends Command<TaskTracker> implements RunCommand {
    run(data: CommandOptions) {
        if (this.chatApi.getCommandRoomName() !== data.roomData.alias) {
            return translate('notCommandRoom');
        }

        const botId = this.chatApi.getMyId();
        const message = translate('alive', { botId });

        return message;
    }
}
