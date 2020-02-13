const translate = require('../../../locales');

const getParsedRooms = room => {
    const [issueName] = room.name.split(' ');
    const project = issueName.includes('-') ? issueName.split('-')[0] : 'others';

    return {
        ...room,
        project,
    };
};

module.exports = async ({ roomId, roomName, chatApi, bodyText }) => {
    if (chatApi.getCommandRoomName() !== roomName) {
        return translate('notCommandRoom');
    }

    const rooms = await chatApi.getRooms();
    const parsedRooms = rooms.map(getParsedRooms).filter(room => (bodyText ? room.project === bodyText : true));
    const singleRooms = parsedRooms.filter(room => room.members.length === 1);

    const messageParams = {
        allRooms: parsedRooms.length,
        single: singleRooms.length,
        many: parsedRooms.length - singleRooms.length,
    };

    return translate('getInfo', messageParams);
};
