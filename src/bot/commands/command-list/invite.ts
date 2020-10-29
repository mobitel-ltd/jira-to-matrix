import { translate } from '../../../locales';
import { Command, RunCommand } from './command-base';
import { CommandOptions, TaskTracker } from '../../../types';

export class InviteCommand extends Command<TaskTracker> implements RunCommand {
    async run({ bodyText: roomName, sender }: CommandOptions) {
        if (!roomName) {
            throw new Error('Not issue room');
        }

        if (!this.config.messenger.admins.includes(sender)) {
            return translate('notAdmin', { sender });
        }

        const targetRoomId = await this.chatApi.getRoomIdByName(roomName);
        if (!targetRoomId) {
            return translate('notFoundRoom', { roomName });
        }

        const userId = this.chatApi.getChatUserId(sender);
        await this.chatApi.invite(targetRoomId, userId);

        return translate('successMatrixInvite', { sender, roomName });
    }
}
