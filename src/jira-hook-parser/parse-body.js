const utils = require('../lib/utils.js');

module.exports = {
    getPostCommentData: body => {
        const headerText = utils.getHeaderText(body);
        const author = utils.getDisplayName(body);
        const issueID = utils.getIssueId(body);
        const comment = utils.getCommentBody(body);

        return { issueID, headerText, comment, author };
    },

    getCreateRoomData: body => {
        const projectKey = utils.getProjectKey(body);
        const summary = utils.getSummary(body);
        const key = utils.getIssueKey(body);
        const id = utils.getIssueId(body);
        const descriptionFields = utils.getDescriptionFields(body);

        const parsedIssue = { key, id, summary, descriptionFields, projectKey };

        return { issue: parsedIssue, projectKey };
    },

    getInviteNewMembersData: body => {
        const key = utils.getKey(body);
        const projectKey = utils.getProjectKey(body);
        const { typeName } = utils.getDescriptionFields(body);

        return { issue: { key, typeName, projectKey } };
    },

    getPostNewLinksData: body => {
        const allLinks = utils.getLinks(body);
        const links = allLinks.map(link => (link ? link.id : link));

        return { links };
    },

    getPostEpicUpdatesData: body => {
        const epicKey = utils.getEpicKey(body);
        const id = utils.getIssueId(body);
        const key = utils.getKey(body);
        const summary = utils.getSummary(body);
        const status = utils.getNewStatus(body);
        const name = utils.getDisplayName(body);

        const data = { key, summary, id, name, status };

        return { epicKey, data };
    },

    getPostLinkedChangesData: body => {
        const changelog = utils.getChangelog(body);
        const id = utils.getIssueId(body);
        const key = utils.getKey(body);
        const status = utils.getNewStatus(body);
        const summary = utils.getSummary(body);
        const name = utils.getDisplayName(body);
        const linksKeys = utils.getLinkKeys(body);

        const data = { status, key, summary, id, changelog, name };

        return { linksKeys, data };
    },

    getPostProjectUpdatesData: body => {
        const typeEvent = utils.getTypeEvent(body);
        const projectKey = utils.getProjectKey(body);
        const name = utils.getDisplayName(body);
        const summary = utils.getSummary(body);
        const status = utils.getNewStatus(body);
        const key = utils.getKey(body);

        const data = { key, summary, name, status };

        return { typeEvent, projectKey, data };
    },

    getPostIssueUpdatesData: body => {
        const author = utils.getDisplayName(body);
        const changelog = utils.getChangelog(body);
        const newKey = utils.getNewKey(body);
        const oldKey = utils.getOldKey(body) || utils.getKey(body);
        const newNameData = newKey
            ? { key: newKey, summary: utils.getSummary(body) }
            : utils.getNewSummary(body) && { key: oldKey, summary: utils.getNewSummary(body) };

        const newStatusId = utils.getNewStatusId(body);

        return { oldKey, newKey, newNameData, changelog, author, newStatusId };
    },

    getPostLinksDeletedData: body => ({
        sourceIssueId: utils.getIssueLinkSourceId(body),
        destinationIssueId: utils.getIssueLinkDestinationId(body),
        sourceRelation: utils.getSourceRelation(body),
        destinationRelation: utils.getDestinationRelation(body),
    }),
};
