const R = require('ramda');
const {postChangesToLinks: conf} = require('../config').features;
const {shouldPostChanges} = require('./post-issue-updates');
const {postStatusChanged, getNewStatus} = require('./post-epic-updates');

async function handleLink(hook, link, mclient) {
    const destIssue = R.either(
        R.prop('outwardIssue'),
        R.prop('inwardIssue')
    )(link);
    if (!destIssue) {
        return;
    }
    const destStatusCat = R.path(['fields', 'status', 'statusCategory', 'id'], destIssue);
    if (conf.ignoreDestStatusCat.includes(destStatusCat)) {
        return;
    }
    const roomID = await mclient.getRoomId(destIssue.key);
    if (!roomID) {
        return;
    }
    postStatusChanged(roomID, hook, mclient);
}

async function sendStatusChanges({mclient, body: hook}) {
    const links = R.path(['issue', 'fields', 'issuelinks'])(hook);
    const status = getNewStatus(hook);
    if (!links ||
        typeof status !== 'string') {
        return;
    }
    links.forEach(async link => {
        await handleLink(hook, link, mclient);
    });
}

async function middleware(req) {
    if (shouldPostChanges(req)) {
        await sendStatusChanges(req);
    }
}

module.exports = middleware;
