const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {schemaMove} = require('./schemas.js');
const {checkCommand, BASE_URL} = require('./helper.js');

const getListCommand = async roomName => {
    // List of available commands
    const {transitions} = await jiraRequest.fetchJSON(
        `${BASE_URL}/${roomName}/transitions`,
        auth()
    );

    if (!transitions) {
        throw new Error(`Jira not return list transitions for ${roomName}`);
    }

    return transitions.map(({name, id}) => ({name, id}));
};

module.exports = async ({body, room, roomName, matrixClient}) => {
    const listCommands = await getListCommand(roomName);

    const moveId = listCommands.reduce((res, cur, index) => {
        // check command
        if (checkCommand(body, cur.name, index)) {
            return {id: cur.id, name: cur.name};
        }
        return res;
    }, 0);

    if (!moveId) {
        let postListCommands = listCommands.reduce(
            (res, cur, index) => `${res}&nbsp;&nbsp;${index + 1})&nbsp;${cur.name}<br>`,
            ''
        );
        postListCommands = `<b>${translate('listJiraCommand')}:</b><br>${postListCommands}`;
        await matrixClient.sendHtmlMessage(room.roomId, 'list commands', postListCommands);
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
