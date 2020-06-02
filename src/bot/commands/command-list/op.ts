import { translate } from '../../../locales';
import { Command, RunCommand } from './command-base';
import { CommandOptions, TaskTracker } from '../../../types';

export class OpCommand extends Command<TaskTracker> implements RunCommand {
    async run({ bodyText, sender, roomId, roomName }: CommandOptions) {
        const targetUser = bodyText || sender;
        // TODO add decorator
        if (!this.config.messenger.admins.includes(sender)) {
            return translate('notAdmin', { sender });
        }

        const userId = this.chatApi.getChatUserId(targetUser);
        const isMember = await this.chatApi.isRoomMember(roomId, userId);
        if (isMember) {
            await this.chatApi.setPower(roomId, userId);

            return translate('powerUp', { targetUser, roomName });
        }

        return translate('notFoundUser', { user: targetUser });
    }
}
