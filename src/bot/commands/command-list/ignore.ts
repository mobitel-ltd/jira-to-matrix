import { translate } from '../../../locales';
import * as utils from '../../../lib/utils';
import { getAllSettingData, setSettingsData } from '../../settings';

export const ignore = async ({ bodyText, roomId, roomName, sender, chatApi, config, taskTracker }) => {
    const jiraBotUser = config.jira.user;
    const projectKey = utils.getProjectKeyFromIssueKey(roomName);
    const { lead, issueTypes, admins } = await taskTracker.getProjectWithAdmins(projectKey);

    if (!admins) {
        return translate('jiraBotWereAreNotInProject', { jiraBotUser });
    }

    const allAdmins = await Promise.all(
        [lead, ...admins].map(displayName => chatApi.getUserIdByDisplayName(displayName)),
    );

    if (!allAdmins.some(name => name.includes(sender))) {
        return translate('notAdmin', { sender });
    }
    const namesIssueTypeInProject = issueTypes.map(({ name }) => name);

    const { [projectKey]: currentIgnore = {} } = await getAllSettingData('ignore');
    const { taskType: currentTaskTypes = [] } = currentIgnore;

    if (!bodyText) {
        return utils.getIgnoreTips(projectKey, currentTaskTypes, 'ignore');
    }

    const [command, typeTaskFromUser] = bodyText.split(' ');

    if (!['add', 'del'].includes(command)) {
        return translate('commandNotFound');
    }

    if (!typeTaskFromUser) {
        return translate('notIgnoreKey');
    }

    if (!namesIssueTypeInProject.includes(typeTaskFromUser)) {
        return utils.ignoreKeysInProject(projectKey, namesIssueTypeInProject);
    }

    switch (command) {
        case 'add':
            if (currentTaskTypes.includes(typeTaskFromUser)) {
                return translate('keyAlreadyExistForAdd', { typeTaskFromUser, projectKey });
            }
            await setSettingsData(
                projectKey,
                { ...currentIgnore, taskType: [...currentTaskTypes, typeTaskFromUser] },
                'ignore',
            );

            return translate('ignoreKeyAdded', { projectKey, typeTaskFromUser });
        case 'del':
            if (!currentTaskTypes.includes(typeTaskFromUser)) {
                return translate('keyNotFoundForDelete', { projectKey });
            }
            await setSettingsData(
                projectKey,
                {
                    ...currentIgnore,
                    taskType: currentTaskTypes.filter(task => task !== typeTaskFromUser),
                },
                'ignore',
            );

            return translate('ignoreKeyDeleted', { projectKey, typeTaskFromUser });
        default:
            return translate('commandNotFound');
    }
};
