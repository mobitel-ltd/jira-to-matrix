const logger = require('../../../modules/log.js')(module);
const {getRoomsLastUpdate, kickAllMembers} = require('./helper.js');
module.exports = async ({sender, matrixClient}) => {
    try {
        const rooms = await matrixClient.getRooms();
        const roomsLastUpdate = getRoomsLastUpdate(rooms, sender);
        const [expectedRoom] = roomsLastUpdate;
        await Promise.all([expectedRoom].map(kickAllMembers(matrixClient)));

        const allRoomsNames = rooms.map(({room}) => room.name);
        logger.info('User %s has kicked all members from rooms:', allRoomsNames);
    } catch (err) {
        throw ['Matrix kick command error', err].join('\n');
    }
};
