const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {schemaMove} = require('./schemas.js');
const {checkCommand, BASE_URL} = require('./helper.js');
const logger = require('../../../modules/log.js')(module);

const getMoveId = async (body, roomName) => {
    // List of available commands
    const {transitions} = await jiraRequest.fetchJSON(
        `${BASE_URL}/${roomName}/transitions`,
        auth()
    );

    if (!transitions) {
        throw new Error(`Jira not return list transitions for ${roomName}`);
    }
    logger.debug('transitions', transitions);

    const moveId = transitions.reduce((acc, {name, id}, index) => {
        // check command
        if (checkCommand(body, name, index)) {
            return {name, id};
        }

        const postListCommands = `${{name, id}}&nbsp;&nbsp;${index + 1})&nbsp;${name}<br>`;

        return `<b>${translate('listJiraCommand')}:</b><br>${postListCommands}`;
    }, {});


    return moveId;
};

module.exports = async ({body, room, roomName, matrixClient}) => {
    logger.debug('body', body);
    logger.debug('roomName', roomName);
    const moveId = await getMoveId(body, roomName);

    if (typeof(moveId) === String) {
        await matrixClient.sendHtmlMessage(room.roomId, 'list commands', moveId);
        return;
    }

    // canged status issue
    const {status} = await jiraRequest.fetchPostJSON(
        `${BASE_URL}/${roomName}/transitions`,
        auth(),
        schemaMove(moveId.id)
    );

    if (status !== 204) {
        const post = translate('errorMoveJira');
        await matrixClient.sendHtmlMessage(room.roomId, 'ERROR', post);
        return `Issue ${roomName} not changed status`;
    }

    const post = translate('successMoveJira', moveId);
    await matrixClient.sendHtmlMessage(room.roomId, post, post);
    return `Issue ${roomName} changed status`;
};
