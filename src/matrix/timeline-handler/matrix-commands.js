/* eslint-disable camelcase */
const translate = require('../../locales');
const {domain, admins} = require('../../config').matrix;

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

const upgradeUser = async (body, sender, room, roomName, self) => {
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

const inviteInRoom = async (body, sender, self) => {
    if (!admins.includes(sender)) {
        return;
    }

    const roomId = await getRoomId(body, self);
    const userId = `@${sender}:${domain}`;
    await self.invite(roomId, userId);
};

const getInfo = () => {
    const indent = '&nbsp;&nbsp;&nbsp;&nbsp;';

    return `
    <h5>Use "!comment" command to comment in jira issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!comment some text</strong></font><br>
        ${indent}text "<font color="green">some text</font>" will be shown in jira comments<br>
    <h5>Use "!assign" command to assign jira issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!assign mv_nosak</strong></font>
        or <font color="green"><strong>!assign Носак</strong></font><br>
        ${indent}user '<font color="green">mv_nosak</font>' will become assignee for the issue<br><br>
        ${indent}<font color="green"><strong>!assign</strong></font><br>
        ${indent}you will become assignee for the issue
    <h5>Use "!move" command to view list of available transitions<br>
    example:</h5>
        ${indent}<font color="green"><strong>!move</strong></font><br>
        ${indent}you will see a list:<br>
        ${indent}${indent}1) Done<br>
        ${indent}${indent}2) On hold<br>
        ${indent}Use <font color="green"><strong>"!move done"</strong></font> or
        <font color="green"><strong>"!move 1"</strong></font>
    <h5>Use "!spec" command to add watcher for issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!spec mv_nosak</strong></font>
        or <font color="green"><strong>!spec Носак</strong></font><br>
        ${indent}user '<font color="green">mv_nosak</font>' was added in watchers for the issue<br><br>
    <h5>Use "!prio" command to changed priority issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!prio</strong></font><br>
        ${indent}you will see a list:<br>
        ${indent}${indent}1) Блокирующий<br>
        ${indent}${indent}2) Критический<br>
        ${indent}${indent}3) Highest<br>
        ${indent}${indent}...<br>
        ${indent}${indent}7) Lowest<br>
        ${indent}${indent}Use <font color="green"><strong>"!prio Lowest"</strong></font> or
        <font color="green"><strong>"!prio 7"</strong></font>
    <h5>Use "!op" command to give moderator rights (admins only)<br>
    example:</h5>
        ${indent}<font color="green"><strong>!op mv_nosak</strong></font><br>
        ${indent}user '<font color="green">mv_nosak</font>' will become the moderator of the room<br><br>
    <h5>Use "!invite" command to invite you in room (admins only)<br>
    example:</h5>
        ${indent}<font color="green"><strong>!invite BBCOM-101</strong></font>
        or <font color="green"><strong>!invite #BBCOM-101:${domain}</strong></font><br>
        ${indent}Bot invite you in room for issue <font color="green">BBCOM-101</font><br><br>
    If you have administrator status, you can invite the bot into the room and he will not be denied:)
    `;
};

const helpInfo = async (room, self) => {
    const post = getInfo();
    await self.sendHtmlMessage(room.roomId, 'Help info', post);
};

module.exports = {
    upgradeUser,
    inviteInRoom,
    helpInfo,
};
