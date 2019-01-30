const logger = require('../../../modules/log.js')(module);
const {getRoomsLastUpdate, kickAllMembers} = require('./helper.js');
const translate = require('../../../locales');

const getKickedRoomsBody = (sender, roomKickInfo) => {
    const roomsHTMLList = roomKickInfo.join('<br><br>');

    return `
        <h5>User <font color="green"><strong>"${sender}"</strong></font> has kicked next members from rooms:</h5>
        <br>${roomsHTMLList}`;
};

const getNoRoomsBody = sender => `
    <h5>User <font color="green"><strong>"${sender}"</strong></font> has no outdated rooms to be kicked from</h5>`;

const getKickInfoBody = (sender, roomKickInfo) => {
    const bodyFunc = roomKickInfo.length ? getKickedRoomsBody : getNoRoomsBody;

    return bodyFunc(sender, roomKickInfo);
};

module.exports = async ({sender, matrixClient, room}) => {
    try {
        const rooms = await matrixClient.getRooms();
        const roomsLastUpdate = getRoomsLastUpdate(rooms, sender);
        const roomKickInfo = await Promise.all(roomsLastUpdate.map(kickAllMembers(matrixClient)));

        const body = getKickInfoBody(sender, roomKickInfo);
        await matrixClient.sendHtmlMessage(room.roomId, 'Kick info', body);

        logger.info(translate('kickInfo', {sender}), roomKickInfo);
    } catch (err) {
        throw ['Matrix kick command error', err].join('\n');
    }
};
