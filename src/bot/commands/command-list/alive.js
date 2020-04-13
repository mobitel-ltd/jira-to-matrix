const translate = require('../../../locales');

module.exports = ({ bodyText, roomName, chatApi }) => {
    if (chatApi.getCommandRoomName() !== roomName) {
        return translate('notCommandRoom');
    }

    const botId = chatApi.getMyId();
    const message = translate('alive', { botId });

    return message;
};
