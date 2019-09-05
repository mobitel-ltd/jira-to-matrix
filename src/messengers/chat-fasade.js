/* eslint require-jsdoc: 0 */
const ramda = require('ramda');
const MessengerAbstract = require('./messenger-abstract');

module.exports = class ChatFasade extends MessengerAbstract {
    constructor(chatPool) {
        super();
        this.chatPool = chatPool;
        this.worker = ramda.last(chatPool);
    }

    getCurrentClient() {
        return this.worker;
    }

    async _getTargetClient(roomId, clientPool = this.chatPool) {
        const [client, ...restClients] = clientPool;
        if (!client) {
            throw new Error(`No bot in room with id = ${roomId}`);
        }
        const status = await client.isInRoom(roomId);
        return status ? client : this._getTargetClient(roomId, restClients);
    }

    getRoomId(data) {
        return this.worker.getRoomId(data);
    }

    async getRoomMembers(data) {
        const id = data.roomId || await this.getRoomId(data.name);
        const client = await this._getTargetClient(id);

        return client.getRoomMembers(data);
    }

    async invite(roomId, userId) {
        const client = await this._getTargetClient(roomId);

        return client.invite(roomId, userId);
    }

    async sendHtmlMessage(roomId, body, htmlBody) {
        const client = await this._getTargetClient(roomId);

        return client.sendHtmlMessage(roomId, body, htmlBody);
    }
};
