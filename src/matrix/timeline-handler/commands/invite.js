/* eslint-disable camelcase */
const {domain, admins} = require('../../../config').matrix;

const getRoomId = async (body, self) => {
    const room = body.substring(8).trim();
    if (~room.indexOf(domain)) {
        const {room_id} = await self.getRoomIdForAlias(room);
        return room_id;
    }

    const alias = `#${room.toUpperCase()}:${domain}`;
    const {room_id} = await self.getRoomIdForAlias(alias);

    return room_id;
};

module.exports = async ({body, sender, self}) => {
    if (!admins.includes(sender)) {
        return;
    }

    const roomId = await getRoomId(body, self);
    const userId = `@${sender}:${domain}`;
    await self.invite(roomId, userId);
};
