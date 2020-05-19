import { translate } from '../../../locales';
import * as utils from '../../../lib/utils';

export const invite = async ({ bodyText: roomName, sender, chatApi }) => {
    if (!utils.isAdmin(sender)) {
        return translate('notAdmin', { sender });
    }

    const targetRoomId = await chatApi.getRoomIdByName(roomName);
    if (!targetRoomId) {
        return translate('notFoundRoom', { roomName });
    }

    const userId = chatApi.getChatUserId(sender);
    await chatApi.invite(targetRoomId, userId);

    return translate('successMatrixInvite', { sender, roomName });
};
