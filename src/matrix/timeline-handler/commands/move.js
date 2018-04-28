const {request, requestPost} = require('../../../lib/request.js');
const translate = require('../../../locales');
const {schemaMove} = require('./schemas.js');
const {checkCommand, BASE_URL} = require('./helper.js');
const logger = require('../../../modules/log.js')(module);

const getMoveId = async (bodyText, roomName) => {
    // List of available commands
    const {transitions} = await request(
        `${BASE_URL}/${roomName}/transitions`,
    );

    if (!transitions) {
        throw new Error(`Jira not return list transitions for ${roomName}`);
    }

    logger.debug('transitions', transitions);

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
        await requestPost(
            `${BASE_URL}/${roomName}/transitions`,
            schemaMove(moveId.id)
        );
        return `Issue ${roomName} changed status`;
    } catch (err) {
        const post = translate('errorMoveJira');
        logger.debug(err);
        await matrixClient.sendHtmlMessage(room.roomId, err, post);
        return `Issue ${roomName} not changed status`;
    }
};
