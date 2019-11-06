const jiraRequests = require('../../../lib/jira-request');
const { request } = require('../../../lib/request.js');
const translate = require('../../../locales');
const utils = require('../../../lib/utils');
const { getAllIgnoreData, setIgnoreData } = require('../../settings');

module.exports = async ({ bodyText, roomId, roomName, sender, chatApi }) => {
    const projectKey = utils.getProjectKeyFromIssueKey(roomName);
    const {
        lead: { key: projectAdmin },
        issueTypes,
        roles: { Administrator = '', Administrators = '' },
    } = await jiraRequests.getProject(projectKey);

    const adminsURL = Administrators || Administrator;
    const { actors = [{ name: '' }] } = await request(adminsURL);
    const admins = [projectAdmin, ...actors.map(({ name }) => name)];

    if (!admins.includes(sender)) {
        return translate('notAdmin', { sender });
    }
    const namesIssueTypeInProject = issueTypes.map(({ name }) => name);

    const { [projectKey]: currentIgnore = {} } = await getAllIgnoreData();
    const { taskType: currentTaskTypes = [] } = currentIgnore;

    if (!bodyText) {
        return utils.getIgnoreTips(projectKey, currentTaskTypes);
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
            await setIgnoreData(projectKey, { ...currentIgnore, taskType: [...currentTaskTypes, typeTaskFromUser] });

            return translate('ignoreKeyAdded', { projectKey, typeTaskFromUser });
        case 'del':
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
