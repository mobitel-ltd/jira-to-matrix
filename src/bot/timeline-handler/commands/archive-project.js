/* eslint-disable id-length */
const { DateTime } = require('luxon');
const { setArchiveProject } = require('../../settings');
const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const logger = require('../../../modules/log')(module);
const { parseBodyText } = require('./common-actions');

const DEFAULT_MONTH = 3;

const LAST_ACTIVE_OPTION = 'lastactive';
const STATUS_OPTION = 'status';

const getValidateMonth = data => {
    if (!data) {
        return DEFAULT_MONTH;
    }
    const numeric = Number(data);

    return Number.isInteger(numeric) && numeric;
};

const projectarchive = async ({ bodyText, sender, chatApi, roomData }) => {
    if (!chatApi.isMaster()) {
        logger.warn('Skip operation for not master bot');

        return;
    }

    if (chatApi.getCommandRoomName() !== roomData.alias) {
        return translate('notCommandRoom');
    }

    if (!bodyText) {
        return translate('emptyProject');
    }

    const textOptions = parseBodyText(bodyText, {
        alias: {
            l: LAST_ACTIVE_OPTION,
            s: STATUS_OPTION,
        },
        string: [LAST_ACTIVE_OPTION, STATUS_OPTION],
        first: true,
    });

    if (textOptions.hasUnknown()) {
        return translate('unknownArgs', { unknownArgs: textOptions.unknown });
    }

    const projectKey = textOptions.param;
    const customMonths = textOptions.get(LAST_ACTIVE_OPTION);

    const month = getValidateMonth(customMonths);
    if (!month) {
        logger.warn(`Command archiveproject was made with incorrect option arg ${customMonths}`);

        return translate('notValid', { body: customMonths });
    }

    if (!(await jiraRequests.isJiraPartExists(projectKey))) {
        logger.warn(`Command archiveproject was made with incorrect project ${projectKey}`);

        return translate('issueNotExistOrPermDen');
    }

    const keepTimestamp = DateTime.local()
        .minus({ month })
        .toMillis();

    if (textOptions.has(STATUS_OPTION)) {
        const status = textOptions.get(STATUS_OPTION);
        if (!(await jiraRequests.hasStatusInProject(projectKey, status))) {
            logger.warn(`Command archiveproject was made with incorrect option arg ${status}`);

            return translate('notValid', { body: status });
        }

        await setArchiveProject(projectKey, { keepTimestamp, status });

        return translate('successProjectAddToArchiveWithStatus', { projectKey, activeTime: month, status });
    }

    await setArchiveProject(projectKey, { keepTimestamp });

    return translate('successProjectAddToArchive', { projectKey, activeTime: month });
};

module.exports = { projectarchive, LAST_ACTIVE_OPTION, DEFAULT_MONTH, STATUS_OPTION };
