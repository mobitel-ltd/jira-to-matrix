const {domain, admins} = require('../../../config').matrix;
const translate = require('../../../locales');
const {getMatrixUserID} = require('../../../lib/utils');

const getRoomId = async (room, matrixClient) => {
    try {
        if (~room.indexOf(domain)) {
            const {room_id: roomId} = await matrixClient.getRoomIdForAlias(room);
            return roomId;
        }

        const alias = `#${room.toUpperCase()}:${domain}`;
        const {room_id: roomId} = await matrixClient.getRoomIdForAlias(alias);

        return roomId;
    } catch (err) {
        throw ['Error in getRoomId', err].join('\n');
    }
};

module.exports = async ({bodyText, sender, room, matrixClient}) => {
    const data = {};
    try {
        if (!admins.includes(sender)) {
            data.body = translate('rightsError');
            return;
        }

        const roomId = await getRoomId(bodyText, matrixClient);
        const userId = getMatrixUserID(sender);
        await matrixClient.invite(roomId, userId);
        data.body = translate('successMatrixInvite');
    } catch (err) {
        data.body = translate('errorMatrixInvite');
        data.err = err;
    } finally {
        await matrixClient.sendHtmlMessage(room.roomId, data.body, data.err || data.body);
    }
};
