const translate = require('../../../locales');
const utils = require('../../../lib/utils');
const helper = require('./helper');
const messages = require('../../../lib/messages');

module.exports = async ({bodyText, sender, room, roomName, matrixClient}) => {
    if (!utils.isAdmin(sender)) {
        const post = translate('notAdmin', {sender});
        await matrixClient.sendHtmlMessage(room.roomId, post, post);

        return post;
    }

    // The object of the matrix that contains information about the user group rights
    const content = await matrixClient.getStateEvent(room.roomId, 'm.room.power_levels', '');
    const event = helper.getEvent(content);

    const userId = utils.getMatrixUserID(bodyText || sender);

    if (helper.isMember(room, userId)) {
        await matrixClient.setPowerLevel(room.roomId, userId, 50, event);

        return messages.getModeratorAddLog(userId, roomName);
    }

    const post = translate('notFoundUser', {user: utils.getNameFromMatrixId(userId)});
    await matrixClient.sendHtmlMessage(room.roomId, post, post);

    return post;
};
