const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const utils = require('../../../lib/utils');
const {getIgnoreList, setIgnoreData} = require('../../settings');

module.exports = async ({bodyText, roomId, roomName, sender, chatApi}) => {
    try {
        const project = utils.getProjectKeyFromIssueKey(roomName);
        const {lead: {key: projectAdmin}, issueTypes} = await jiraRequests.getProject(project);
        if (projectAdmin !== sender) {
            return translate('notAdmin', {sender});
        }
        const namesIssueTypeInProject = issueTypes.map(({name}) => name);

        const ignoreSettingsAll = await getIgnoreList();

        const {[project]: currentIgnore = {}} = JSON.parse(ignoreSettingsAll);
        const {taskType: currentTaskTypes = []} = currentIgnore;

        if (!bodyText) {
            return utils.getIgnoreTips(project, currentTaskTypes);
        }

        const [command, typeTaskFromUser] = bodyText.split(' ');

        if (!typeTaskFromUser) {
            return translate('notIgnoreKey');
        }

        if (!namesIssueTypeInProject.includes(typeTaskFromUser)) {
            return translate('notKeyInProject', {project});
        }
        switch (command) {
            case 'add':
                if (currentTaskTypes.includes(typeTaskFromUser)) {
                    return translate('keyAlreadyExistForAdd', {typeTaskFromUser, project});
                }
                await setIgnoreData(project, {...currentIgnore, taskType: [...currentTaskTypes, typeTaskFromUser]});
                return translate('ignoreKeyAdded', {project, typeTaskFromUser});
            case 'del':
                if (!currentTaskTypes.includes(typeTaskFromUser)) {
                    return translate('keyNotFoundForDelete', {project});
                }
                await setIgnoreData(project, {
                    ...currentIgnore,
                    taskType: currentTaskTypes.filter(task => task !== typeTaskFromUser),
                });
                return translate('ignoreKeyDeleted', {project, typeTaskFromUser});
            default:
                return translate('commandNotFound');
        }
    } catch (err) {
        console.log(err);
    }
};
