const Ramda = require('ramda');
const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const utils = require('../../../lib/utils');
const logger = require('../../../modules/log')(module);

module.exports = async ({ bodyText = '', roomId, roomName, sender, chatApi }) => {
    try {
        const [issueType, ...wordsNameNewIssue] = bodyText.split(' ');
        const nameNewIssue = wordsNameNewIssue.join(' ');
        const [projectKey] = utils.getProjectKeyFromIssueKey(roomName);
        const { id: projectId, issueTypes } = await jiraRequests.getProject(projectKey);
        const namesIssueTypeInProject = issueTypes.map(({ name }) => name);

        if (!bodyText || !issueType || !namesIssueTypeInProject.includes(issueType)) {
            return utils.ignoreKeysInProject(projectKey, namesIssueTypeInProject);
        }

        if (!nameNewIssue) {
            return translate('issueNameExist');
        }
        if (nameNewIssue.length > 255 || nameNewIssue.includes('\n')) {
            return translate('issueNameTooLong');
        }

        const { id: issueTypeId } = Ramda.find(Ramda.propEq('name', issueType))(issueTypes);
        const { key: newIssueKey } = await jiraRequests.createIssue(nameNewIssue, issueTypeId, projectId);
        await jiraRequests.createIssueLink(roomName, newIssueKey);
    } catch (err) {
        logger.error(err);
    }
};
