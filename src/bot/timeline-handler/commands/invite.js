const translate = require('../../../locales');
const utils = require('../../../lib/utils');

const getRoomId = (text, chatApi) => {
    try {
        const alias = utils.isRoomName(text) ? text : utils.getMatrixRoomAlias(text.toUpperCase());

        return chatApi.getRoomId(alias);
    } catch (err) {
        return false;
    }
};

module.exports = async ({bodyText: roomName, sender, room, chatApi}) => {
    try {
        if (!utils.isAdmin(sender)) {
            const message = translate('notAdmin', {sender});
            await chatApi.sendHtmlMessage(room.roomId, message, message);

            return message;
        }

        const roomId = await getRoomId(roomName, chatApi);
        if (!roomId) {
            const message = translate('notFoundRoom', {roomName});
            await chatApi.sendHtmlMessage(room.roomId, message, message);

            return message;
        }

        const userId = utils.getChatUserId(sender);
        await chatApi.invite(roomId, userId);
        const message = translate('successMatrixInvite', {sender, roomName});
        await chatApi.sendHtmlMessage(room.roomId, message, message);

        return message;
    } catch (err) {
        throw utils.errorTracing('Matrix Invite command', err);
    }
};
