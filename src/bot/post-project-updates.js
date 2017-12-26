const translate = require('../locales');
const marked = require('marked');
const jira = require('../jira');
const logger = require('../modules/log.js')(module);

const getEpicChangedMessageBody = ({summary, key, status, name}) => {
    const issueRef = jira.issue.ref(key);
    const values = {name, key, summary, status, issueRef};

    const body = translate('statusEpicChanged');
    const message = translate('statusEpicChangedMessage', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const getNewEpicMessageBody = ({key, summary}) => {
    const issueRef = jira.issue.ref(key);
    const values = {key, summary, issueRef};

    const body = translate('newEpicInProject');
    const message = translate('epicAddedToProject', values, values.name);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const postProjectUpdates = async ({mclient, typeEvent, projectOpts, data}) => {
    try {
        if (!projectOpts) {
            logger.debug('No project in body.issue.fields');
            return true;
        }

        const roomId = await mclient.getRoomId(projectOpts.key);
        if (!roomId) {
            return;
        }

        if (typeEvent === 'issue_created') {
            const {body, htmlBody} = getNewEpicMessageBody(data);
            await mclient.sendHtmlMessage(roomId, body, htmlBody);
        }

        if (typeEvent === 'issue_generic') {
            const {body, htmlBody} = getEpicChangedMessageBody(data);
            await mclient.sendHtmlMessage(roomId, body, htmlBody);
        }
    } catch (err) {
        logger.error('error in postProjectUpdates');
        throw err;
    }
};

module.exports = {postProjectUpdates, getNewEpicMessageBody, getEpicChangedMessageBody};
