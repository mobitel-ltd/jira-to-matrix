const translate = require('../../../locales');
const utils = require('../../../lib/utils');

const getRoomId = (text, matrixClient) => {
    try {
        const alias = utils.isMatrixRoomName(text) ? text : utils.getMatrixRoomAlias(text.toUpperCase());

        return matrixClient.getRoomId(alias);
    } catch (err) {
        return false;
    }
};

const getBody = async (roomName, sender, matrixClient) => {
    if (!utils.isAdmin(sender)) {
        return translate('notAdmin', {sender});
    }

    const roomId = await getRoomId(roomName, matrixClient);
    if (!roomId) {
        return translate('notFoundRoom', {roomName});
    }

    const userId = utils.getMatrixUserID(sender);
    await matrixClient.invite(roomId, userId);

    return translate('successMatrixInvite', {sender, roomName});
};

module.exports = async ({bodyText, sender, room, matrixClient}) => {
    try {
        const body = await getBody(bodyText, sender, matrixClient);
        await matrixClient.sendHtmlMessage(room.roomId, body, body);

        return body;
    } catch (err) {
        throw utils.errorTracing('Matrix Invite command', err);
    }
};
