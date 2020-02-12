const ramda = require('ramda');
const translate = require('../../../locales');

const isCommandRoom = (chatApi, roomName) => ramda.pathEq('config.roomInfo.name', roomName, chatApi);

module.exports = ({ bodyText, roomId, roomName, chatApi }) => {
    if (isCommandRoom) {
        const botId = chatApi.getMyId();
        const message = `Bot ${botId} is alive!`;

        return message;
    }

    return translate('notCommandRoom');
};
