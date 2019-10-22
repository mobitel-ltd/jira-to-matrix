const translate = require('../../../locales');
const utils = require('../../../lib/utils');

module.exports = async ({ bodyText: roomName, sender, chatApi }) => {
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
