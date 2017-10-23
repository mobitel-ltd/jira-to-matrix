const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {checkNamePriority, BASE_URL} = require('./helper.js');
const {shemaFields} = require('./schemas.js');

module.exports = async ({body, room, roomName, matrixClient}) => {
    const prioName = body.substring(6).trim();

    const {fields} = await jiraRequest.fetchJSON(
        `${BASE_URL}/${roomName}/editmeta`,
        auth()
    );

    if (!fields) {
        throw new Error(`Jira not return list priorities for ${roomName}`);
    }

    const priorities = fields.priority.allowedValues;

    const priority = priorities.reduce((prev, cur, index) => {
        if (checkNamePriority(cur, index, prioName)) {
            return {id: cur.id, name: cur.name};
        }
        return prev;
    }, 0);

    if (!priority) {
        const listPrio = priorities.reduce(
            (prev, cur, index) => `${prev}${index + 1}) ${cur.name}<br>`,
            ''
        );
        await matrixClient.sendHtmlMessage(room.roomId, 'List priorities', listPrio);
        return;
    }

    await jiraRequest.fetchPutJSON(
        `${BASE_URL}/${roomName}`,
        auth(),
        shemaFields(priority.id)
    );

    const post = translate('setPriority', priority);
    await matrixClient.sendHtmlMessage(room.roomId, 'Successful set priority', post);

    return `Issue ${roomName} now has priority ${priority.name}`;
};
