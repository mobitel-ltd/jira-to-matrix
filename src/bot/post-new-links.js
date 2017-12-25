const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const marked = require('marked');
const redis = require('../redis-client.js');
const jira = require('../jira');
const translate = require('../locales');

const getPostLinkMessageBody = ({relation, related}) => {
    const {key} = related;
    const issueRef = jira.issue.ref(key);
    const summary = Ramda.path(['fields', 'summary'], related);
    const values = {key, relation, summary, issueRef};

    const body = translate('newLink');
    const message = translate('newLinkMessage', values);
    const htmlBody = marked(message);

    return {body, htmlBody};
};

const postLink = async (issue, relation, related, mclient) => {
    const roomID = await mclient.getRoomId(issue.key);
    if (!roomID) {
        return;
    }

    const {body, htmlBody} = getPostLinkMessageBody({relation, related});
    await mclient.sendHtmlMessage(roomID, body, htmlBody);
};

const handleLink = async (issueLink, mclient) => {
    try {
        const link = await jira.link.get(issueLink.id);
        if (!link) {
            return;
        }
        const isNew = await redis.setnxAsync(`link|${link.id}`, '1');

        if (!isNew) {
            logger.info(`link ${link.id} is already been posted to room`);
            return;
        }
        await postLink(link.inwardIssue, link.type.outward, link.outwardIssue, mclient);
        await postLink(link.outwardIssue, link.type.inward, link.inwardIssue, mclient);
    } catch (err) {
        logger.error(`HandleLink error in post link`);

        throw err;
    }
};

module.exports = async ({mclient, links}) => {
    logger.info('start postNewLinks');
    try {
        if (!links || links.length === 0) {
            logger.debug('No links to handle');
            return true;
        }

        await Promise.all(links.map(async issueLink => {
            await handleLink(issueLink, mclient);
        }));
        return true;
    } catch (err) {
        logger.error('error in postNewLinks');
        throw err;
    }
};
