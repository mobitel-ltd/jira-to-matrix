const translate = require('../../../locales');
const utils = require('../../../lib/utils');

module.exports = async ({ bodyText, sender, roomId, roomName, chatApi }) => {
    const targetUser = bodyText || sender;
    if (!utils.isAdmin(sender)) {
        return translate('notAdmin', { sender });
    }

    const userId = chatApi.getChatUserId(targetUser);
    const isMember = await chatApi.isRoomMember(roomId, userId);
    if (isMember) {
        await chatApi.setPower(roomId, userId);

        return translate('powerUp', { targetUser, roomName });
    }

    return translate('notFoundUser', { user: targetUser });
};
