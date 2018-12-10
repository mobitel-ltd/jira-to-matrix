const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const marked = require('marked');
const redis = require('../redis-client.js');
const {getProjectUrl, getLinkedIssue} = require('../lib/jira-request.js');
const translate = require('../locales');

const getPostLinkMessageBody = ({relation, related}) => {
    const {key} = related;
    const issueRef = getProjectUrl(key);
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

const handleLink = async (issueLinkId, mclient) => {
    try {
        const link = await getLinkedIssue(issueLinkId);

        if (!link) {
            return;
        }
        const isNew = await redis.setnxAsync(`link|${link.id}`, '1');

        if (!isNew) {
            logger.debug(`link ${link.id} is already been posted to room`);
            return;
        }
        await postLink(link.inwardIssue, link.type.outward, link.outwardIssue, mclient);
        await postLink(link.outwardIssue, link.type.inward, link.inwardIssue, mclient);
    } catch (err) {
        throw ['HandleLink error in post link', err].join('\n');
    }
};

module.exports = async ({mclient, links}) => {
    try {
        await Promise.all(links.map(async issueLink => {
            await handleLink(issueLink, mclient);
        }));

        return true;
    } catch (err) {
        throw ['Error in postNewLinks', err].join('\n');
    }
};
