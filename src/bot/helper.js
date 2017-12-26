const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const jira = require('../jira');
const translate = require('../locales');
const marked = require('marked');

const getNewStatus = Ramda.pipe(
    Ramda.pathOr([], ['issue', 'changelog', 'items']),
    Ramda.filter(Ramda.propEq('field', 'status')),
    Ramda.head,
    Ramda.propOr(null, 'toString')
);

const postStatusData = data => {
    const {status} = data;
    logger.debug('status is ', status);
    if (typeof status !== 'string') {
        logger.warn('No status in postStatusData');

        return {};
    }

    const issueRef = jira.issue.ref(data.key);
    const baseValues = {status, issueRef};
    const values = ['name', 'key', 'summary']
        .reduce((acc, key) => ({...acc, [key]: data[key]}), baseValues);

    const body = translate('statusHasChanged', values);
    const message = translate('statusHasChangedMessage', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const postStatusChanged = async ({mclient, roomID, data}) => {
    const {body, htmlBody} = postStatusData(data);
    if (!body) {
        logger.warn('No body for sending to Matrix');
        return;
    }
    try {
        await mclient.sendHtmlMessage(roomID, body, htmlBody);
    } catch (err) {
        logger.error('Error in postStatusChanged');

        throw err;
    }
};

module.exports = {
    getNewStatus,
    postStatusData,
    postStatusChanged,
};
