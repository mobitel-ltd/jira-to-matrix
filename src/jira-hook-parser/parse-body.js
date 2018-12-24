const utils = require('../lib/utils.js');

const getLinksData = body => {
    const allLinks = utils.getLinks(body);
    const links = allLinks.map(link => (link ? link.id : link));

    return {links};
};

module.exports = {
    getPostCommentData: body => {
        const headerText = utils.getHeaderText(body);
        const author = utils.getCommentAuthor(body);
        const issueID = utils.extractID(body);
        const comment = utils.getCommentBody(body);

        return {issueID, headerText, comment, author};
    },

    getCreateRoomData: body => {
        const projectOpts = utils.getCreateProjectOpts(body);
        const roomMembers = utils.getIssueMembers(body);
        const url = utils.getWatchersUrl(body);
        const summary = utils.getSummary(body);
        const key = utils.getKey(body);
        const id = utils.getIssueId(body);
        const webhookEvent = utils.getBodyWebhookEvent(body);
        const descriptionFields = utils.getDescriptionFields(body);

        const parsedIssue = {key, id, roomMembers, url, summary, descriptionFields};

        return {issue: parsedIssue, webhookEvent, projectOpts};
    },

    getInviteNewMembersData: body => {
        const roomMembers = utils.getIssueMembers(body);
        const url = utils.getWatchersUrl(body);
        const key = utils.getKey(body);

        return {issue: {key, roomMembers, url}};
    },

    getPostNewLinksData: getLinksData,

    getPostEpicUpdatesData: body => {
        const epicKey = utils.getEpicKey(body);
        const changelog = utils.getIssueChangelog(body);
        const id = utils.getIssueId(body);
        const key = utils.getKey(body);
        const summary = utils.getSummary(body);
        const name = utils.getUserName(body);
        const status = utils.getNewStatus(body);

        const data = {key, summary, id, changelog, name, status};

        return {epicKey, data};
    },

    getPostLinkedChangesData: body => {
        const changelog = utils.getChangelog(body);
        const id = utils.getIssueId(body);
        const key = utils.getKey(body);
        const status = utils.getNewStatus(body);
        const summary = utils.getSummary(body);
        const name = utils.getUserName(body);
        const linksKeys = utils.getLinkKeys(body);

        const data = {status, key, summary, id, changelog, name};

        return {linksKeys, data};
    },

    getPostProjectUpdatesData: body => {
        const typeEvent = utils.getTypeEvent(body);
        const projectOpts = utils.getIssueProjectOpts(body);
        const name = utils.getUserName(body);
        const summary = utils.getSummary(body);
        const status = utils.getStatus(body);
        const key = utils.getKey(body);

        const data = {key, summary, name, status};

        return {typeEvent, projectOpts, data};
    },

    getPostIssueUpdatesData: body => {
        const {user, issue} = body;
        const changelog = utils.getChangelog(body);
        const fieldKey = utils.getChangelogField('Key', body);
        const key = utils.getKey(body);
        const issueKey = fieldKey ? fieldKey.fromString : key;
        const summary = utils.getSummary(body);
        const roomName = summary && utils.composeRoomName({...issue, summary});

        return {issueKey, fieldKey, summary, roomName, changelog, user, key};
    },

    getDeleteLinksData: getLinksData,
};
