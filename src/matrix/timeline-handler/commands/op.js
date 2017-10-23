const translate = require('../../../locales');
const {domain, admins} = require('../../../config').matrix;

const getEvent = async (roomId, self) => {
    const content = await self.getStateEvent(roomId, 'm.room.power_levels', '');
    const event = {
        getType() {
            return 'm.room.power_levels';
        },
        getContent() {
            return content;
        },
    };

    return event;
};

const isMember = (room, userId) => {
    const members = room.getMembersWithMembership('join');
    return members.reduce((prev, cur) => {
        if (cur.userId === userId) {
            return true;
        }
        return prev;
    }, false);
};

module.exports = async ({body, sender, room, roomName, self}) => {
    if (!admins.includes(sender)) {
        return;
    }

    const event = await getEvent(room.roomId, self);

    if (body === '!op') {
        const userId = `@${sender}:${domain}`;
        await self.setPowerLevel(room.roomId, userId, 50, event);

        return `User ${sender} became a moderator for room ${roomName}`;
    }

    const user = body.substring(4);
    const userId = `@${user}:${domain}`;

    if (isMember(room, userId)) {
        await self.setPowerLevel(room.roomId, userId, 50, event);
        return `User ${user} became a moderator for room ${roomName}`;
    }

    const post = translate('notFoundUser');
    await self.sendHtmlMessage(room.roomId, post, post);
};
