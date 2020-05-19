import * as utils from '../../../lib/utils';
import { translate } from '../../../locales';

const getSenderDisplayName = async (chatApi, senderId) => {
    const chatId = chatApi.getChatUserId(senderId);
    const userData = await chatApi.getUser(chatId);

    return userData && userData.displayName;
};

export const assign = async ({ bodyText, sender, roomName, chatApi, roomId, taskTracker }) => {
    try {
        const userToFind = bodyText || (await getSenderDisplayName(chatApi, sender));
        const users = await taskTracker.searchUser(userToFind);

        switch (users.length) {
            case 0: {
                return translate('errorMatrixAssign', { userToFind });
            }
            case 1: {
                const [{ displayName, accountId }] = users;

                await taskTracker.addAssignee(accountId, roomName);
                const userId = await chatApi.getUserIdByDisplayName(displayName);
                await chatApi.invite(roomId, userId);

                return translate('successMatrixAssign', { displayName });
            }
            default: {
                return utils.getListToHTML(users);
            }
        }
    } catch (err) {
        if (typeof err === 'string') {
            if (err.includes('status is 403')) {
                return translate('setBotToAdmin');
            }

            if (err.includes('status is 404')) {
                return translate('noRulesToWatchIssue');
            }

            throw utils.errorTracing('Assign command', err);
        }

        throw err;
    }
};
