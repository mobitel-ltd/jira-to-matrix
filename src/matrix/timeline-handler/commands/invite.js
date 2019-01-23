const translate = require('../../../locales');
const utils = require('../../../lib/utils');

const getRoomId = async (room, matrixClient) => {
    try {
        const alias = utils.isMatrixRoomName(room) ? room : utils.getMatrixRoomAlias(room.toUpperCase());
        const {room_id: roomId} = await matrixClient.getRoomIdForAlias(alias);

        return roomId;
    } catch (err) {
        throw ['Error in getRoomId', err].join('\n');
    }
};

module.exports = async ({bodyText, sender, room, matrixClient}) => {
    const data = {};
    try {
        if (!utils.isAdmin(sender)) {
            data.body = translate('rightsError');
            return;
        }

        const roomId = await getRoomId(bodyText, matrixClient);
        const userId = utils.getMatrixUserID(sender);
        await matrixClient.invite(roomId, userId);
        data.body = translate('successMatrixInvite');
    } catch (err) {
        data.body = translate('errorMatrixInvite');
        data.err = err;
    } finally {
        await matrixClient.sendHtmlMessage(room.roomId, data.body, data.err || data.body);
    }
};
