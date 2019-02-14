const translate = require('../../../locales');
const utils = require('../../../lib/utils');
const helper = require('./helper');
const messages = require('../../../lib/messages');

module.exports = async ({bodyText, sender, room, roomName, chatApi}) => {
    try {
        if (!utils.isAdmin(sender)) {
            const post = translate('notAdmin', {sender});
            await chatApi.sendHtmlMessage(room.roomId, post, post);

            return post;
        }

        const userId = utils.getMatrixUserID(bodyText || sender);

        if (helper.isMember(room, userId)) {
            await chatApi.setPower(room.roomId, userId);

            return messages.getModeratorAddLog(userId, roomName);
        }

        const post = translate('notFoundUser', {user: utils.getNameFromMatrixId(userId)});
        await chatApi.sendHtmlMessage(room.roomId, post, post);

        return post;
    } catch (err) {
        throw utils.errorTracing('Matrix Op command', err);
    }
};
