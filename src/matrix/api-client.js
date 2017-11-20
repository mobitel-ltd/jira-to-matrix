/* eslint-disable camelcase */
const lodash = require('lodash');
const to = require('await-to-js').default;
const conf = require('../config').matrix;
const logger = require('debug')('api client');
const cbTimeline = require('./timeline-handler');

const api = {};

const getAlias = alias => `#${alias}:${conf.domain}`;

api.createRoom = client => async function createRoom(options) {
    const [err, response] = await to(
        client.createRoom(Object.assign({visibility: 'private'}, options))
    );
    if (err) {
        logger(`Error while creating room:\n ${err}`);
        return;
    }
    return response;
};

api.getRoomId = client => async function getRoomId(alias) {
    const [err, response] = await to(
        client.getRoomIdForAlias(getAlias(alias))
    );
    if (err) {
        if (err.errcode !== 'M_NOT_FOUND') {
            logger(
                `Error while getting room id for ${alias} from Matrix:\n${err}`
            );
        }
        return;
    }
    const {room_id} = response;
    return room_id;
};

api.getRoomByAlias = client => async function getRoomByAlias(alias) {
    const [err, roomID] = await to(
        client.getRoomIdForAlias(getAlias(alias))
    );
    if (err) {
        if (err.errcode !== 'M_NOT_FOUND') {
            logger(
                `Error while getting room id for ${alias} from Matrix:\n${err}`
            );
        }
        return;
    }
    const room = client.getRoom(roomID.room_id);
    return room;
};

api.getRoomMembers = () => async function GetRoomMembers(roomAlias) {
    const room = await this.getRoomByAlias(roomAlias);
    if (!room) {
        logger(`Don't return room for alias ${roomAlias}`);
        return;
    }
    return lodash.values(room.currentState.members).map(member => member.userId);
};

api.invite = client => async function invite(roomId, userId) {
    const [err, response] = await to(client.invite(roomId, userId));
    if (err) {
        logger(`Error while inviting a new member to a room:\n ${err}`);
        return;
    }
    return response;
};

api.sendHtmlMessage = client => async function sendHtmlMessage(roomId, body, htmlBody) {
    const [err] = await to(client.sendHtmlMessage(roomId, body, htmlBody));
    if (err) {
        logger(`Error while sending message to a room:\n ${err}`);
    }
    return !err;
};

api.createAlias = client => async function createAlias(alias, roomId) {
    const [err] = await to(client.createAlias(
        getAlias(alias),
        roomId
    ));
    if (err) {
        logger(`Error while creating alias for a room:\n ${err}`);
    }
    return !err;
};

api.setRoomName = client => async function setRoomName(roomId, name) {
    const [err] = await to(client.setRoomName(roomId, name));
    if (err) {
        logger(`Error while setting room name:\n ${err}`);
    }
    return !err;
};

api.setRoomTopic = client => async function setRoomTopic(roomId, topic) {
    const [err] = await to(client.setRoomTopic(roomId, topic));
    if (err) {
        logger(`Error while setting room's topic:\n ${err}`);
    }
    return !err;
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
        logger(`Count listener for ${eventName} ${listCount}. To remove unnecessary listener`);
    }
};

module.exports = sdkConnect => async () => {
    logger('Matrix connection in apiClient');
    const matrixClient = await sdkConnect();
    // logger(matrixClient);
    if (!matrixClient) {
        logger('\'matrixClient\' is undefined');
        return;
    }

    // logger('cbTimeline', cbTimeline);
    matrixClient.on('Room.timeline', cbTimeline);

    matrixClient.on('sync', (state, prevState, data) => {
        // logger(this);
        removeListener('Room.timeline', cbTimeline, matrixClient);
        removeListener('event', inviteBot, matrixClient);

        if (state !== 'SYNCING' || prevState !== 'SYNCING') {
            logger(`state: ${state}`);
            logger(`prevState: ${prevState}`);
        }
    });

    matrixClient.on('event', inviteBot);

    const apiClient = Object.values(api)
        .map(func => func(matrixClient));

    return apiClient;
};
