const {
    jira: { user: jiraBotUser },
} = require('../../../config');
const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const utils = require('../../../lib/utils');
const { getAllSettingData, setSettingsData } = require('../../settings');

module.exports = async ({ bodyText, roomId, roomName, sender, chatApi }) => {
    const projectKey = utils.getProjectKeyFromIssueKey(roomName);
    const {
        lead: { key: projectAdmin },
        issueTypes,
        admins,
    } = await jiraRequests.getProjectWithAdmins(projectKey);

    if (!admins) {
        return translate('jiraBotWereAreNotInProject', { jiraBotUser });
    }

    const allAdmins = [projectAdmin, ...admins.map(({ name }) => name)];

    if (!allAdmins.includes(sender)) {
        return translate('notAdmin', { sender });
    }
    const namesIssueTypeInProject = issueTypes.map(({ name }) => name);

    const { [projectKey]: currentInvite = {} } = await getAllSettingData('autoinvite');

    // to do
    if (!bodyText) {
        return utils.getIgnoreTips(projectKey, Object.entries(currentInvite), 'autoinvite');
    }
    const [command, typeTaskFromUser, userFromCommand] = bodyText.split(' ');
    const { [typeTaskFromUser]: currentUsers = [] } = currentInvite;

    if (!['add', 'del'].includes(command) || !typeTaskFromUser || !userFromCommand) {
        return translate('invalidCommand');
    }

    if (!namesIssueTypeInProject.includes(typeTaskFromUser)) {
        return utils.ignoreKeysInProject(projectKey, namesIssueTypeInProject);
    }
    // to do
    const matrixUserFromCommand = await chatApi.getChatUserId(userFromCommand);
    if (!(await chatApi.getUser(matrixUserFromCommand))) {
        return translate('notInMatrix', { userFromCommand });
    }

    switch (command) {
        case 'add':
            if (currentUsers.includes(matrixUserFromCommand)) {
                return translate('keyAlreadyExistForAdd', { typeTaskFromUser: matrixUserFromCommand, projectKey });
            }
            await setSettingsData(
                projectKey,
                {
                    ...currentInvite,
                    [typeTaskFromUser]: [...currentUsers, matrixUserFromCommand],
                },
                'autoinvite',
            );

            return translate('autoinviteKeyAdded', { projectKey, matrixUserFromCommand });
        case 'del':
            if (!currentUsers.includes(matrixUserFromCommand)) {
                return translate('keyNotFoundForDelete', { projectKey });
            }
            await setSettingsData(
                projectKey,
                {
                    ...currentInvite,
                    [typeTaskFromUser]: currentUsers.filter(task => task !== matrixUserFromCommand),
                },
                'autoinvite',
            );

            return translate('autoinviteKeyDeleted', { projectKey, matrixUserFromCommand });
        default:
            return translate('invalidCommand');
    }
};
