const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {checkNamePriority, BASE_URL} = require('./helper.js');
const {shemaFields} = require('./schemas.js');

module.exports = async ({body, room, roomName, self}) => {
    const prioName = body.substring(6).trim();

    const {fields} = await jiraRequest.fetchJSON(
        `${BASE_URL}/${roomName}/editmeta`,
        auth()
    );

    if (!fields) {
        throw new Error(`Jira not return list prioritys for ${roomName}`);
    }

    const prioritys = fields.priority.allowedValues;

    const priority = prioritys.reduce((prev, cur, index) => {
        if (checkNamePriority(cur, index, prioName)) {
            return {id: cur.id, name: cur.name};
        }
        return prev;
    }, 0);

    if (!priority) {
        const listPrio = prioritys.reduce(
            (prev, cur, index) => `${prev}${index + 1}) ${cur.name}<br>`,
            ''
        );
        await self.sendHtmlMessage(room.roomId, 'List prioritys', listPrio);
        return;
    }

    await jiraRequest.fetchPutJSON(
        `${BASE_URL}/${roomName}`,
        auth(),
        shemaFields(priority.id)
    );

    const post = translate('setPriority', priority);
    await self.sendHtmlMessage(room.roomId, 'Successful set priority', post);

    return `Issue ${roomName} now has priority ${priority.name}`;
};
