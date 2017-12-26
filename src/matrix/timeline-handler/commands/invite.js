/* eslint-disable camelcase */
const {domain, admins} = require('../../../config').matrix;

const getRoomId = async (room, matrixClient) => {
    if (~room.indexOf(domain)) {
        const {room_id} = await matrixClient.getRoomIdForAlias(room);
        return room_id;
    }

    const alias = `#${room.toUpperCase()}:${domain}`;
    const {room_id} = await matrixClient.getRoomIdForAlias(alias);

    return room_id;
};

module.exports = async ({bodyText, sender, matrixClient}) => {
    if (!admins.includes(sender)) {
        return;
    }

    const roomId = await getRoomId(bodyText, matrixClient);
    const userId = `@${sender}:${domain}`;
    await matrixClient.invite(roomId, userId);
};
