const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const {getProjectUrl} = require('../jira').issue;
const translate = require('../locales');
const marked = require('marked');

const getEpicChangedMessageBody = ({summary, key, status, name}) => {
    const issueRef = getProjectUrl(key);
    const values = {name, key, summary, status, issueRef};

    const body = translate('statusEpicChanged');
    const message = translate('statusEpicChangedMessage', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const getNewEpicMessageBody = ({key, summary}) => {
    const issueRef = getProjectUrl(key);
    const values = {key, summary, issueRef};

    const body = translate('newEpicInProject');
    const message = translate('epicAddedToProject', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

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

    const issueRef = getProjectUrl(data.key);
    const baseValues = {status, issueRef};
    const values = ['name', 'key', 'summary']
        .reduce((acc, key) => ({...acc, [key]: data[key]}), baseValues);

    const body = translate('statusHasChanged', values);
    const message = translate('statusHasChangedMessage', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const postStatusChanged = async ({mclient, roomID, data}) => {
    try {
        const {body, htmlBody} = postStatusData(data);
        if (!body) {
            logger.warn('No body for sending to Matrix');
            return;
        }

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
    getEpicChangedMessageBody,
    getNewEpicMessageBody,
};
