const Ramda = require('ramda');
const to = require('await-to-js').default;
const logger = require('debug')('post-new-links');
const marked = require('marked');
const redis = require('../redis-client');
const jira = require('../jira');
const translate = require('../locales');

const postLink = async (issue, relation, related, mclient) => {
    const roomID = await mclient.getRoomId(issue.key);
    if (!roomID) {
        return;
    }
    const values = {
        relation,
        key: related.key,
        summary: Ramda.path(['fields', 'summary'], related),
        ref: jira.issue.ref(related.key),
    };
    await mclient.sendHtmlMessage(
        roomID,
        translate('newLink'),
        marked(translate('newLinkMessage', values))
    );
};

const handleLink = async (issueLink, mclient) => {
    const link = await jira.link.get(issueLink.id);
    if (!link) {
        return;
    }
    const [err, isNew] = await to(
        redis.setnxAsync(`link|${link.id}`, '1')
    );
    if (err) {
        logger(`Redis error while SETNX new link\n${err.message}`);
        return;
    }
    if (!isNew) {
        return;
    }
    await postLink(link.inwardIssue, link.type.outward, link.outwardIssue, mclient);
    await postLink(link.outwardIssue, link.type.inward, link.inwardIssue, mclient);
};

const postNewLinks = async ({mclient, links}) => {
    logger('start postNewLinks');
    try {
        if (!links || links.length === 0) {
            logger('No links to handle');
            return true;
        }

        await Promise.all(links.map(async issueLink => {
            await handleLink(issueLink, mclient);
        }));
        return true;
    } catch (err) {
        logger('error in postNewLinks', err);
        return false;
    }
};

module.exports = {postNewLinks};
