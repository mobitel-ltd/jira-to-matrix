const {getProjectUrl, getRenderedValues} = require('../jira').issue;
const translate = require('../locales');
const logger = require('../modules/log.js')(module);

const fieldNames = items =>
    items.reduce((acc, {field}) =>
        (field ? [...acc, field] : acc), []);

const itemsToString = items =>
    items.reduce((acc, {field, toString}) =>
        (field ? {...acc, [field]: toString} : acc), {});

const composeText = ({author, fields, formattedValues}) => {
    const messageHeader = `${author} ${translate('issue_updated', null, author)}`;
    const changesDescription = fields.map(field =>
        `${field}: ${formattedValues[field]}`);

    return [messageHeader, ...changesDescription].join('<br>');
};

const postUpdateInfo = async (mclient, roomID, {changelog, key, user}) => {
    try {
        const author = user.displayName;
        const fields = fieldNames(changelog.items);
        const changelogItemsTostring = itemsToString(changelog.items);
        const renderedValues = await getRenderedValues(key, fields);

        const formattedValues = {...changelogItemsTostring, ...renderedValues};

        const htmlBody = composeText({author, fields, formattedValues});
        const body = translate('issueHasChanged');

        await mclient.sendHtmlMessage(roomID, body, htmlBody);

        logger.debug(`Posted updates to ${key}`);
    } catch (err) {
        logger.error('Error postUpdateInfo');

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
        logger.info(`Successfully added alias ${fieldKey.toString} for room ${fieldKey.fromString}`);
    }

    await mclient.setRoomTopic(roomID, getProjectUrl(issueKey));
};

const rename = async (mclient, roomID, body) => {
    const {summary, roomName, issueKey} = body;

    if (!summary && !issueKey) {
        return;
    }

    const success = await mclient.setRoomName(roomID, roomName);

    if (success) {
        logger.info(`Successfully renamed room ${issueKey}`);
    }
};

const postIssueUpdates = async body => {
    try {
        logger.debug('Start postIssueUpdates');
        const {issueKey, mclient} = body;
        const roomID = await mclient.getRoomId(issueKey);

        if (!roomID) {
            logger.debug('No roomId');

            return true;
        }

        await move(mclient, roomID, body);
        await rename(mclient, roomID, body);
        await postUpdateInfo(mclient, roomID, body);

        return true;
    } catch (err) {
        logger.error('error in postIssueUpdates');

        throw err;
    }
};

module.exports = {
    postIssueUpdates,
    forTests: {
        itemsToString,
        composeText,
        fieldNames,
    },
};
