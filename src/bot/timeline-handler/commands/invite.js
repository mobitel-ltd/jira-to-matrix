const translate = require('../../../locales');
const utils = require('../../../lib/utils');

module.exports = async ({bodyText: roomName, sender, roomId, chatApi}) => {
    try {
        if (!utils.isAdmin(sender)) {
            return translate('notAdmin', {sender});
        }

        const targetRoomId = await chatApi.getRoomIdByName(roomName);
        if (!targetRoomId) {
            return translate('notFoundRoom', {roomName});
        }

        const userId = utils.getChatUserId(sender);
        await chatApi.invite(targetRoomId, userId);

        return translate('successMatrixInvite', {sender, roomName});
    } catch (err) {
        throw utils.errorTracing('Matrix Invite command', err);
    }
};
