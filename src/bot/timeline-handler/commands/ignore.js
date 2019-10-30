const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const utils = require('../../../lib/utils');
const { getAllIgnoreData, setIgnoreData } = require('../../settings');

module.exports = async ({ bodyText, roomId, roomName, sender, chatApi }) => {
    const projectKey = utils.getProjectKeyFromIssueKey(roomName);
    const {
        lead: { key: projectAdmin },
        issueTypes,
    } = await jiraRequests.getProject(projectKey);
    if (projectAdmin !== sender) {
        return translate('notAdmin', { sender });
    }
    const namesIssueTypeInProject = issueTypes.map(({ name }) => name);

    const { [projectKey]: currentIgnore = {} } = await getAllIgnoreData();
    const { taskType: currentTaskTypes = [] } = currentIgnore;

    if (!bodyText) {
        return utils.getIgnoreTips(projectKey, currentTaskTypes);
    }

    const [command, typeTaskFromUser] = bodyText.split(' ');

    switch (command) {
        case 'add':
            if (!typeTaskFromUser) {
                return translate('notIgnoreKey');
            }

            if (!namesIssueTypeInProject.includes(typeTaskFromUser)) {
                return utils.ignoreKeysInProject(projectKey, namesIssueTypeInProject);
            }
            if (currentTaskTypes.includes(typeTaskFromUser)) {
                return translate('keyAlreadyExistForAdd', { typeTaskFromUser, projectKey });
            }
            await setIgnoreData(projectKey, { ...currentIgnore, taskType: [...currentTaskTypes, typeTaskFromUser] });

            return translate('ignoreKeyAdded', { projectKey, typeTaskFromUser });
        case 'del':
            if (!typeTaskFromUser) {
                return translate('notIgnoreKey');
            }

            if (!namesIssueTypeInProject.includes(typeTaskFromUser)) {
                return utils.ignoreKeysInProject(projectKey, namesIssueTypeInProject);
            }
            if (!currentTaskTypes.includes(typeTaskFromUser)) {
                return translate('keyNotFoundForDelete', { projectKey });
            }
            await setIgnoreData(projectKey, {
                ...currentIgnore,
                taskType: currentTaskTypes.filter(task => task !== typeTaskFromUser),
            });

            return translate('ignoreKeyDeleted', { projectKey, typeTaskFromUser });
        default:
            return translate('commandNotFound');
    }
};
