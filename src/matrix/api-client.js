/* eslint-disable camelcase, no-use-before-define */
const _ = require('lodash');
const R = require('ramda');
const to = require('await-to-js').default;
const conf = require('../config');
const logger = require('simple-color-logger')();
const fetchPostJSON = require('../utils').fetchPostJSON;
const cbTimeline = require('./timeline-handler.js');

const api = {};

api.createRoom = client => (
    async function createRoom(options) {
        const [err, response] = await to(
            client.createRoom(Object.assign({visibility: 'private'}, options))
        );
        if (err) {
            logger.error(`Error while creating room:\n ${err}`);
            return;
        }
        return response;
    }
);

api.getRoomId = client => (
    async function getRoomId(alias) {
        const [err, response] = await to(
            client.getRoomIdForAlias(`#${alias}:${conf.matrix.domain}`)
        );
        if (err) {
            if (err.errcode !== 'M_NOT_FOUND') {
                logger.warn(
                    `Error while getting room id for ${alias} from Matrix:\n${err}`
                );
            }
            return;
        }
        const {room_id} = response;
        return room_id;
    }
);

api.getRoomByAlias = client => (
    async function getRoomByAlias(alias) {
        const [err, roomID] = await to (
            client.getRoomIdForAlias(`#${alias}:${conf.matrix.domain}`)
        );
        if (err) {
            if (err.errcode !== 'M_NOT_FOUND') {
                logger.warn(
                    `Error while getting room id for ${alias} from Matrix:\n${err}`
                );
            }
            return;
        }
        const room = client.getRoom(roomID.room_id);
        return room;
    }
);

api.getRoomMembers = () => (
    async function getRoomMembers(roomAlias) {
        const room = await this.getRoomByAlias(roomAlias);
        if (!room) {
            logger.warn(`Don't return room for alias ${roomAlias}`);
            return;
        }
        return _.values(room.currentState.members).map(member => member.userId);
    }
);

api.invite = client => (
    async function invite(roomId, userId) {
        const [err, response] = await to(client.invite(roomId, userId));
        if (err) {
            logger.error(`Error while inviting a new member to a room:\n ${err}`);
            return;
        }
        return response;
    }
);

api.sendHtmlMessage = client => (
    async function sendHtmlMessage(roomId, body, htmlBody) {
        const [err] = await to(client.sendHtmlMessage(roomId, body, htmlBody));
        if (err) {
            logger.error(`Error while sending message to a room:\n ${err}`);
        }
        return !err;
    }
);

api.createAlias = client => (
    async function createAlias(alias, roomId) {
        const [err] = await to(client.createAlias(
            `#${alias}:${conf.matrix.domain}`,
            roomId
        ));
        if (err) {
            logger.error(`Error while creating alias for a room:\n ${err}`);
        }
        return !err;
    }
);

api.setRoomName = client => (
    async function setRoomName(roomId, name) {
        const [err] = await to(client.setRoomName(roomId, name));
        if (err) {
            logger.error(`Error while setting room name:\n ${err}`);
        }
        return !err;
    }
);

api.setRoomTopic = client => (
    async function setRoomTopic(roomId, topic) {
        const [err] = await to(client.setRoomTopic(roomId, topic));
        if (err) {
            logger.error(`Error while setting room's topic:\n ${err}`);
        }
        return !err;
    }
);

module.exports = sdkConnect => (
    async function connect() {
        const matrixClient = await sdkConnect();
        if (!matrixClient) {
            logger.error("'matrixClient' is undefined");
            return;
        }
        // await matrixClient.clearStores();
        matrixClient.on("Room.timeline", cbTimeline);

        matrixClient.on("sync", function(state, prevState, data) {
            if (state !== 'SYNCING' || prevState !== 'SYNCING') {
                logger.warn(`state: ${state}`);
                logger.warn(`prevState: ${prevState}`);
            }
            return;
        });
        
        return R.map(closer => closer(matrixClient))(api);
    }
);
