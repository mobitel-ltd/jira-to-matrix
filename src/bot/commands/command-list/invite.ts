import { translate } from '../../../locales';
import * as utils from '../../../lib/utils';
import { Command, RunCommand } from './command-base';
import { CommandOptions } from '../../../types';

export class InviteCommand extends Command implements RunCommand {
    async run({ bodyText: roomName, sender }: CommandOptions) {
        if (!roomName) {
            throw new Error('Not issue room');
        }

        if (!utils.isAdmin(sender)) {
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
