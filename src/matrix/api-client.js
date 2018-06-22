const conf = require('../config').matrix;
const logger = require('../modules/log.js')(module);
const cbTimeline = require('./timeline-handler');
const Ramda = require('ramda');

// TODO: delete EVENT_EXCEPTION check in errors after resolving 'no-event' bug
const EVENT_EXCEPTION = 'Could not find event';
const BOT_OUT_OF_ROOM_EXEPTION = `User ${conf.userId} not in room`;

const getAlias = alias => `#${alias}:${conf.domain}`;

const getRooms = client => () =>
    client.getRooms();

const createRoom = client => async options => {
    try {
        const {room_id: roomId} = await client.createRoom({visibility: 'private', ...options});
        return roomId;
    } catch (err) {
        throw ['Error while creating room', err].join('\n');
    }
};

const getRoomId = client => async alias => {
    try {
        const {room_id: roomId} = await client.getRoomIdForAlias(getAlias(alias));
        return roomId;
    } catch (err) {
        logger.warn(`No room id for ${alias} from Matrix\n`, err);

        return null;
    }
};

const getRoomByAlias = client => async alias => {
    try {
        const {room_id: roomId} = await client.getRoomIdForAlias(getAlias(alias));

        const room = await client.getRoom(roomId);
        return room;
    } catch (err) {
        logger.warn(`No room for alias ${alias} from Matrix\n`, err);

        return null;
    }
};

const invite = client => async (roomId, userId) => {
    try {
        const response = await client.invite(roomId, userId);

        return response;
    } catch (err) {
        if (err.message.includes(EVENT_EXCEPTION)) {
            logger.warn(err.message);

            return null;
        }

        throw ['Error while inviting a new member to a room:', err].join('\n');
    }
};

const sendHtmlMessage = client => async (roomId, body, htmlBody) => {
    try {
        await client.sendHtmlMessage(roomId, body, htmlBody);
    } catch (err) {
        if (err.message.includes(`${conf.userId} not in room`) || err.message.includes(EVENT_EXCEPTION)) {
            logger.warn(err.message);

            return null;
        }

        throw ['Error in sendHtmlMessage', err].join('\n');
    }
};

const createAlias = client => async (alias, roomId) => {
    const newAlias = getAlias(alias);
    try {
        await client.createAlias(newAlias, roomId);
    } catch (err) {
        if (err.message.includes(`Room alias ${newAlias} already exists`)) {
            logger.warn(err.message);

            return null;
        }
        logger.error(err);
        throw ['Error while creating alias for a room', err].join('\n');
    }
};

const setRoomName = client => async (roomId, name) => {
    try {
        await client.setRoomName(roomId, name);
        return true;
    } catch (err) {
        if (err.message.includes(EVENT_EXCEPTION) || err.message.includes(BOT_OUT_OF_ROOM_EXEPTION)) {
            logger.warn(err.message);

            return false;
        }

        throw ['Error while setting room name', err].join('\n');
    }
};

const setRoomTopic = client => async (roomId, topic) => {
    try {
        await client.setRoomTopic(roomId, topic);
    } catch (err) {
        if (err.message.includes(EVENT_EXCEPTION)) {
            logger.warn(err.message);

            return null;
        }

        throw [`Error while setting room's topic`, err].join('\n');
    }
};

const api = {
    getRooms,
    createRoom,
    getRoomId,
    getRoomByAlias,
    invite,
    sendHtmlMessage,
    createAlias,
    setRoomName,
    setRoomTopic,
};

const inviteBot = async function InviteBot(event) {
    if (event.event.membership !== 'invite') {
        return;
    }

    let sender = event.getSender();
    sender = sender.slice(1, -conf.postfix);

    if (
        !conf.admins.includes(sender)
        && sender !== conf.user
        && event.getStateKey() === conf.userId
    ) {
        await this.leave(event.getRoomId());
        return;
    }

    if (event.getStateKey() === conf.userId) {
        await this.joinRoom(event.getRoomId());
    }
};

const removeListener = (eventName, listener, matrixClient) => {
    const listCount = matrixClient.listenerCount(eventName);
    if (listCount > 1) {
        matrixClient.removeListener(eventName, listener);
        logger.warn(`Count listener for ${eventName} ${listCount}. To remove unnecessary listener`);
    }
};

module.exports = matrixClient => {
    if (!matrixClient) {
        logger.error('matrixClient is undefined');
        return;
    }

    matrixClient.on('Room.timeline', cbTimeline);

    matrixClient.on('sync', (state, prevState, data) => {
        removeListener('Room.timeline', cbTimeline, matrixClient);
        removeListener('event', inviteBot, matrixClient);

        if (state !== 'SYNCING' || prevState !== 'SYNCING') {
            logger.warn(`state: ${state}`);
            logger.warn(`prevState: ${prevState}`);
        }
    });

    matrixClient.on('event', inviteBot);

    return Ramda.map(closer => closer(matrixClient))(api);
};
