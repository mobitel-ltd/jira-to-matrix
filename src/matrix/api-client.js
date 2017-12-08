/* eslint-disable camelcase */
// const lodash = require('lodash');
const conf = require('../config').matrix;
const logger = require('../modules/log.js')(module);
const cbTimeline = require('./timeline-handler');
const Ramda = require('ramda');

const api = {};

const getAlias = alias => `#${alias}:${conf.domain}`;

api.createRoom = client => async options => {
    try {
        await client.createRoom(Object.assign({visibility: 'private'}, options));
    } catch (err) {
        logger.error(`Error while creating room`);

        throw err;
    }
};

api.getRoomId = client => async alias => {
    try {
        const {room_id} = await client.getRoomIdForAlias(getAlias(alias));

        return room_id;
    } catch (err) {
        logger.error(
            `Error while getting room id for ${alias} from Matrix`
        );

        throw err;
    }
};

api.getRoomByAlias = client => async alias => {
    try {
        const roomID = await client.getRoomIdForAlias(getAlias(alias));

        const room = await client.getRoom(roomID.room_id);
        return room;
    } catch (err) {
        logger.error(`Error while getting room id for ${alias} from Matrix:`);

        throw err;
    }
};

// api.getRoomMembers = () => async function GetRoomMembers(roomAlias) {
//     const room = await this.getRoomByAlias(roomAlias);
//     if (!room) {
//         logger.warn(`Don't return room for alias ${roomAlias}`);
//         return;
//     }
//     return lodash.values(room.currentState.members).map(member => member.userId);
// };

api.invite = client => async (roomId, userId) => {
    try {
        const response = await client.invite(roomId, userId);

        return response;
    } catch (err) {
        logger.error(`Error while inviting a new member to a room:\n ${err}`);

        throw err;
    }
};

api.sendHtmlMessage = client => async (roomId, body, htmlBody) => {
    try {
        await client.sendHtmlMessage(roomId, body, htmlBody);
    } catch (err) {
        logger.error(`Error while sending message to a room`);

        throw err;
    }
};

api.createAlias = client => async (alias, roomId) => {
    try {
        await client.createAlias(
            getAlias(alias),
            roomId
        );
    } catch (err) {
        logger.error(`Error while creating alias for a room`);

        throw err;
    }
};

api.setRoomName = client => async (roomId, name) => {
    try {
        await client.setRoomName(roomId, name);
    } catch (err) {
        logger.error(`Error while setting room name`);

        throw err;
    }
};

api.setRoomTopic = client => async (roomId, topic) => {
    try {
        await client.setRoomTopic(roomId, topic);
    } catch (err) {
        logger.error(`Error while setting room's topic`);

        throw err;
    }
};

const inviteBot = async function InviteBot(event) {
    if (event.event.membership !== 'invite') {
        return;
    }

    let sender = event.getSender();
    sender = sender.slice(1, -conf.postfix);

    if (!conf.admins.includes(sender) && sender !== conf.user) {
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

module.exports = sdkConnect => async () => {
    const matrixClient = await sdkConnect();
    if (!matrixClient) {
        logger.error('\'matrixClient\' is undefined');
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
