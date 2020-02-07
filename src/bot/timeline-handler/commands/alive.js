// const ramda = require('ramda');
// const translate = require('../../../locales');

// const isCommandRoom = (chatApi, roomName) => ramda.pathEq('config.roomInfo.name', roomName, chatApi);

// module.exports = async ({ bodyText, roomId, roomName, chatApi }) => {
//     if (isCommandRoom) {
//         const message = `Bot ${chatApi.config.user} is alive!`;
//         await chatApi.sendHtmlMessage(roomId, message);

//         return message;
//     }

//     return translate('notCommandRoom');
// };
