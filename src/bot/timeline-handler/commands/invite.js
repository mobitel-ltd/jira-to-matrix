const translate = require('../../../locales');
const utils = require('../../../lib/utils');

const getRoomId = (text, chatApi) => {
    try {
        const alias = utils.isMatrixRoomName(text) ? text : utils.getMatrixRoomAlias(text.toUpperCase());

        return chatApi.getRoomId(alias);
    } catch (err) {
        return false;
    }
};

const getBody = async (roomName, sender, chatApi) => {
    if (!utils.isAdmin(sender)) {
        return translate('notAdmin', {sender});
    }

    const roomId = await getRoomId(roomName, chatApi);
    if (!roomId) {
        return translate('notFoundRoom', {roomName});
    }

    const userId = utils.getChatUserId(sender);
    await chatApi.invite(roomId, userId);

    return translate('successMatrixInvite', {sender, roomName});
};

module.exports = async ({bodyText, sender, room, chatApi}) => {
    try {
        const body = await getBody(bodyText, sender, chatApi);
        await chatApi.sendHtmlMessage(room.roomId, body, body);

        return body;
    } catch (err) {
        throw utils.errorTracing('Matrix Invite command', err);
    }
};
