const { DateTime } = require('luxon');
const { setArchiveProject } = require('../../settings');
const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');

const DEFAULT_MONTH = 3;

const LAST_ACTIVE_OPTION = 'lastactive';

const getValidateMonth = data => {
    if (!data) {
        return DEFAULT_MONTH;
    }
    const numeric = Number(data);

    return Number.isInteger(numeric) && numeric;
};

const parseBodyText = bodyText => {
    const [param, ...optionWithParams] = bodyText
        .split('--')
        .filter(Boolean)
        .map(el => el.trim());
    const options = optionWithParams
        .map(el => {
            const [optionName, ...optionParams] = el.split(' ').filter(Boolean);

            return {
                [optionName]: optionParams.join(' '),
            };
        })
        .reduce((acc, val) => ({ ...acc, ...val }), {});

    return {
        param,
        options,
    };
};

const projectarchive = async ({ bodyText, sender, chatApi }) => {
    if (!bodyText) {
        return translate('emptyProject');
    }

    const data = parseBodyText(bodyText);
    const projectKey = data.param;
    const customMonths = data.options[LAST_ACTIVE_OPTION];

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

    return translate('successProjectAddToArchive', { projectKey, activeTime: month });
};

module.exports = { projectarchive, parseBodyText, LAST_ACTIVE_OPTION, DEFAULT_MONTH };
