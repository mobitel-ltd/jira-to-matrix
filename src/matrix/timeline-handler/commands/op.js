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

    const userId = utils.getMatrixUserID(bodyText || sender);

    if (helper.isMember(room, userId)) {
        await matrixClient.setPower(room.roomId, userId);

        return messages.getModeratorAddLog(userId, roomName);
    }

    const post = translate('notFoundUser', {user: utils.getNameFromMatrixId(userId)});
    await matrixClient.sendHtmlMessage(room.roomId, post, post);

    return post;
};
