import { translate } from '../../../locales';
import * as utils from '../../../lib/utils';

export const spec = async ({ bodyText, roomId, roomName, chatApi, taskTracker }) => {
    try {
        const users = await taskTracker.searchUser(bodyText);
        switch (users.length) {
            case 0: {
                return translate('errorWatcherJira');
            }
            case 1: {
                const [{ displayName, accountId }] = users;

                await taskTracker.addWatcher(accountId, roomName);
                const userId = await chatApi.getUserIdByDisplayName(displayName);
                await chatApi.invite(roomId, userId);

                return translate('successWatcherJira');
            }
            default: {
                return utils.getListToHTML(users);
            }
        }
    } catch (err) {
        if (err.includes('status is 403')) {
            const projectKey = utils.getProjectKeyFromIssueKey(roomName);
            const viewUrl = utils.getViewUrl(projectKey);
            return translate('setBotToAdmin', { projectKey, viewUrl });
        }

        if (err.includes('status is 404')) {
            return translate('noRulesToWatchIssue');
        }

        throw utils.errorTracing('Spec command', err);
    }
};
