const { DateTime } = require('luxon');
const { setArchiveProject } = require('../../settings');
const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');

const DEFAULT_MONTH = 3;

const getValidateMonth = data => {
    if (!data) {
        return DEFAULT_MONTH;
    }
    const numeric = Number(data);

    return Number.isInteger(numeric) && numeric;
};

const archiveProject = async ({ bodyText, sender, chatApi }) => {
    if (!bodyText) {
        return translate('emptyProject');
    }

    const [projectKey, customMonths] = bodyText.split('_');
    const month = getValidateMonth(customMonths);
    if (!month) {
        return translate('notValid', { body: customMonths });
    }

    if (!(await jiraRequests.isJiraPartExists(projectKey))) {
        return translate('roomNotExistOrPermDen');
    }

    const timeStamp = DateTime.local()
        .minus({ month })
        .toMillis();

    await setArchiveProject(projectKey, timeStamp);

    return translate('successProjectAddToArchive', { projectKey });
};

module.exports = archiveProject;
