const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const {checkCommand} = require('./helper.js');
const logger = require('../../../modules/log.js')(module);
const messages = require('../../../lib/messages');

const getMoveId = async (bodyText, roomName) => {
    // List of available commands
    const transitions = await jiraRequests.getPossibleIssueStatuses(roomName);

    const moveId = transitions.find(({name, id}, index) => checkCommand(bodyText, name, index));
    if (moveId) {
        return moveId;
    }

    const listCommands = transitions.reduce((acc, {name, id}, index) =>
        `${acc}&nbsp;&nbsp;${index + 1})&nbsp;${name}<br>`, []);

    return `<b>${translate('listJiraCommand')}:</b><br>${listCommands}`;
};

module.exports = async ({bodyText, body, room, roomName, matrixClient}) => {
    try {
        const moveId = await getMoveId(bodyText, roomName);
        if (typeof moveId === 'string') {
            await matrixClient.sendHtmlMessage(room.roomId, 'list commands', moveId);

            return;
        }

        // canged status issue
        await jiraRequests.postIssueStatus(roomName, moveId.id);

        return messages.getMoveSuccessLog(roomName);
    } catch (err) {
        const post = translate('errorMoveJira');
        logger.error(err);
        await matrixClient.sendHtmlMessage(room.roomId, post, post);

        return post;
    }
};
