const translate = require('../../../locales');
const utils = require('../../../lib/utils');
const messages = require('../../../lib/messages');

module.exports = async ({bodyText, sender, roomId, roomName, chatApi}) => {
    try {
        if (!utils.isAdmin(sender)) {
            const post = translate('notAdmin', {sender});
            await chatApi.sendHtmlMessage(roomId, post, post);

            return post;
        }

        const userId = utils.getChatUserId(bodyText || sender);

        if (await chatApi.isRoomMember(roomId, userId)) {
            await chatApi.setPower(roomId, userId);

            return messages.getModeratorAddLog(userId, roomName);
        }

        const post = translate('notFoundUser', {user: utils.getNameFromMatrixId(userId)});
        await chatApi.sendHtmlMessage(roomId, post, post);

        return post;
    } catch (err) {
        throw utils.errorTracing('Matrix Op command', err);
    }
};
