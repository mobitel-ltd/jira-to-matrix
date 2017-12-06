const Ramda = require('ramda');
const jira = require('../jira');
const translate = require('../locales');
const logger = require('debug')('bot post issue update');

const helpers = {
    fieldNames: items => Ramda.pipe(
        Ramda.map(Ramda.prop('field')),
        Ramda.uniq
    )(items || []),

    toStrings: items =>
        items.reduce((result, item) =>
            Ramda.merge(result, {[item.field]: item.toString}),
        {}),
};

const composeText = ({author, fields, formattedValues}) => {
    const messageHeader = () => `${author} ${translate('issue_updated', null, author)}`;
    const changesDescription = () =>
        fields.map(field => `${field}: ${formattedValues[field]}`);

    return [messageHeader(author)]
        .concat(changesDescription(fields, formattedValues))
        .join('<br>');
};


const postUpdateInfo = async (mclient, roomID, body) => {
    try {
        const {changelog, key, user} = body;
        const fields = helpers.fieldNames(changelog.items);

        const formattedValues = Object.assign(
            {},
            helpers.toStrings(changelog.items),
            await jira.issue.renderedValues(key, fields)
        );

        await mclient.sendHtmlMessage(
            roomID,
            translate('issueHasChanged'),
            composeText({
                author: Ramda.path(['displayName'], user),
                fields,
                formattedValues,
            })
        );

        logger(`Posted updates to ${key}`);
    } catch (err) {
        logger('Error postUpdateInfo');

        throw err;
    }
};


const move = async (mclient, roomID, body) => {
    const {issueKey, fieldKey, summary} = body;

    if (!(fieldKey && summary)) {
        return;
    }

    const success = await mclient.createAlias(fieldKey.toString, roomID);

    if (success) {
        logger(`Successfully added alias ${fieldKey.toString} for room ${fieldKey.fromString}`);
    }

    await mclient.setRoomTopic(roomID, jira.issue.ref(issueKey));
};

const rename = async (mclient, roomID, body) => {
    const {summary, roomName, issueKey} = body;

    if (!summary && !issueKey) {
        return;
    }

    const success = await mclient.setRoomName(roomID, roomName);

    if (success) {
        logger(`Successfully renamed room ${issueKey}`);
    }
};

const postIssueUpdates = async body => {
    try {
        logger('Start postIssueUpdates');
        const {issueKey, mclient} = body;
        const roomID = await mclient.getRoomId(issueKey);

        if (!roomID) {
            logger('No roomId');

            return true;
        }

        await move(mclient, roomID, body);
        await rename(mclient, roomID, body);
        await postUpdateInfo(mclient, roomID, body);

        return true;
    } catch (err) {
        logger('error in postIssueUpdates');

        throw err;
    }
};

module.exports.postIssueUpdates = postIssueUpdates;
module.exports.forTests = {
    toStrings: helpers.toStrings,
    composeText,
};
