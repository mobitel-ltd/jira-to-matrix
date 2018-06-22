const logger = require('../../../modules/log.js')(module);
const {getRoomsLastUpdate, kickAllMembers} = require('./helper.js');
const translate = require('../../../locales');

module.exports = async ({sender, matrixClient, room}) => {
    try {
        const rooms = await matrixClient.getRooms();
        const roomsLastUpdate = getRoomsLastUpdate(rooms, sender);
        const roomKickInfo = await Promise.all(roomsLastUpdate.map(kickAllMembers(matrixClient)));
        // this way is for testing to choose only one
        // const [expectedRoom] = roomsLastUpdate;
        // logger.debug('expectedRoom', expectedRoom);
        // await Promise.all([expectedRoom].map(kickAllMembers(matrixClient)));

        // Next block allow to show msg to riot, but it can't be seen because msg is printed after kicking
        // const allRoomsNames = roomsLastUpdate.map(({room}) => room.roomName);
        // const roomsHTMLList = roomKickInfo.join('<br><br>');
        // const body = `
        //     <h5>User <font color="green"><strong>"${sender}"</strong></font> has kicked next members from rooms:</h5>
        //     <br>${roomsHTMLList}`;

        // await matrixClient.sendHtmlMessage(room.roomId, 'Kick info', body);

        logger.info(translate('kickInfo', {sender}), roomKickInfo);
        logger.debug(translate('kickInfo', {sender}), roomKickInfo);
    } catch (err) {
        throw ['Matrix kick command error', err].join('\n');
    }
};
