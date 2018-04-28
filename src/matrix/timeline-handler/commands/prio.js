const {request, requestPut} = require('../../../lib/request.js');
const translate = require('../../../locales');
const {checkNamePriority, BASE_URL} = require('./helper.js');
const {shemaFields} = require('./schemas.js');

module.exports = async ({bodyText, room, roomName, matrixClient}) => {
    try {
        const {fields} = await request(
            `${BASE_URL}/${roomName}/editmeta`,
        );

        if (!fields) {
            throw new Error(`Jira not return list priorities for ${roomName}`);
        }

        const priorities = fields.priority.allowedValues;

        const priority = priorities.reduce((prev, cur, index) => {
            if (checkNamePriority(cur, index, bodyText)) {
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

        await requestPut(
            `${BASE_URL}/${roomName}`,
            shemaFields(priority.id)
        );

        const post = translate('setPriority', priority);
        await matrixClient.sendHtmlMessage(room.roomId, 'Successful set priority', post);

        return `Issue ${roomName} now has priority ${priority.name}`;
    } catch (err) {
        throw ['Matrix prio command error', err].join('\n');
    }
};
