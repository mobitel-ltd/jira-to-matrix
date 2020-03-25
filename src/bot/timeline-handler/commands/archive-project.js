const { setArchiveProject } = require('../../settings');
const utils = require('../../../lib/utils');
const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');

const archiveProject = async ({ bodyText, sender, chatApi }) => {
    if (!bodyText) {
        return translate('emptyProject');
    }

    if (!(await jiraRequests.isJiraPartExists(bodyText))) {
        return translate('roomNotExistOrPermDen');
    }

    const projectKey = utils.getProjectKeyFromIssueKey(bodyText);

    await setArchiveProject(projectKey);

    return translate('successProjectAddToArchive', { projectKey });
};

module.exports = archiveProject;
