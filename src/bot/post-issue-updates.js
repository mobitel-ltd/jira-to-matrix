const Ramda = require('ramda');
const jira = require('../jira');
const translate = require('../locales');
const {composeRoomName} = require('../matrix').helpers;
const logger = require('debug')('bot post issue update');

const helpers = {
    fieldNames: items => Ramda.pipe(
        Ramda.map(Ramda.prop('field')),
        Ramda.uniq
    )(items || []),

    toStrings: items => items.reduce(
        (result, item) => Ramda.merge(result, {[item.field]: item.toString}),
        {}
    ),
};

const composeText = ({author, fields, formattedValues}) => {
    const messageHeader = () => `${author} ${translate('issue_updated', null, author)}`;
    const changesDescription = () => fields.map(
        field => `${field}: ${formattedValues[field]}`
    );
    return [messageHeader(author)]
        .concat(changesDescription(fields, formattedValues))
        .join('<br>');
};

const postUpdateInfo = async (mclient, roomID, hook) => {
    const {changelog, issue, user} = hook;
    const fields = helpers.fieldNames(changelog.items);
    const formattedValues = Object.assign(
        {},
        helpers.toStrings(changelog.items),
        await jira.issue.renderedValues(issue.key, fields)
    );
    const success = await mclient.sendHtmlMessage(
        roomID,
        translate('issueHasChanged'),
        composeText({
            author: Ramda.path(['displayName'], user),
            fields,
            formattedValues,
        })
    );
    if (success) {
        logger(`Posted updates to ${issue.key}`);
    }
};


const getPostIssueUpdatesData = body => {
    const fieldKey = jira.getChangelogField('Key', body);
    const issueKey = fieldKey ? fieldKey.fromString : body.issue.key;
    const summary = Ramda.path(['fields', 'summary'], body.issue);
    const roomName = summary ? composeRoomName({...body.issue, summary}) : null;

    
    return {issueKey, fieldKey, summary, roomName};
};

const move = async (mclient, roomID, fieldKey, issueKey) => {
    if (!fieldKey) {
        return;
    }
    const success = await mclient.createAlias(fieldKey.toString, roomID);
    if (success) {
        logger(`Successfully added alias ${fieldKey.toString} for room ${fieldKey.fromString}`);
    }
    await mclient.setRoomTopic(roomID, jira.issue.ref(issueKey));
};

const rename = async (mclient, roomID, summary, roomName, issueKey) => {
    if (!summary && !issueKey) {
        return;
    }
    const success = await mclient.setRoomName(roomID, roomName);
    if (success) {
        logger(`Successfully renamed room ${issueKey}`);
    }
};

//

//

const postIssueUpdates = async ({mclient, issueKey, fieldKey, body}) => {
    try {
        const roomID = await mclient.getRoomId(issueKey);
        if (!roomID) {
            logger('No roomId');
            return true;
        }
        await move(mclient, roomID, fieldKey, issueKey);
        await rename(mclient, roomID, body);
        await postUpdateInfo(mclient, roomID, body);
        return true;
    } catch (err) {
        logger('Error in postIssueUpdates', err);
        return false;
    }
};

module.exports.postIssueUpdates = postIssueUpdates;
module.exports.forTests = {
    toStrings: helpers.toStrings,
    composeText,
};
