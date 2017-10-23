const translate = require('../../../locales');
const {domain, admins} = require('../../../config').matrix;

const getEvent = async (roomId, matrixClient) => {
    // The object of the matrix that contains information about the user group rights
    const content = await matrixClient.getStateEvent(roomId, 'm.room.power_levels', '');
    const event = {
        getType() {
            return 'm.room.power_levels';
        },
        getContent() {
            return content;
        },
    };

    // This object is used as argument for the function matrixClient.setPowerLevel()
    // It needs to contain a synchronous method in getType() and getContent()
    return event;
};

const isMember = (room, userIdMatrix) => {
    const members = room.getJoinedMembers();
    for (const {userId} of members) {
        if (userId === userIdMatrix) {
            return true;
        }
    }
    return false;
};

module.exports = async ({body, sender, room, roomName, matrixClient}) => {
    if (!admins.includes(sender)) {
        return;
    }

    const event = await getEvent(room.roomId, matrixClient);

    if (body === '!op') {
        const userId = `@${sender}:${domain}`;
        await matrixClient.setPowerLevel(room.roomId, userId, 50, event);

        return `User ${sender} became a moderator for room ${roomName}`;
    }

    const user = body.substring(4);
    const userId = `@${user}:${domain}`;

    if (isMember(room, userId)) {
        await matrixClient.setPowerLevel(room.roomId, userId, 50, event);
        return `User ${user} became a moderator for room ${roomName}`;
    }

    const post = translate('notFoundUser');
    await matrixClient.sendHtmlMessage(room.roomId, post, post);
};
