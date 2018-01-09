const {fetchJSON, fetchPutJSON} = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {checkNamePriority, BASE_URL} = require('./helper.js');
const {shemaFields} = require('./schemas.js');
const logger = require('../../../modules/log.js')(module);

module.exports = async ({bodyText, room, roomName, matrixClient}) => {
    try {
        const {fields} = await fetchJSON(
            `${BASE_URL}/${roomName}/editmeta`,
            auth()
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

        const status = await fetchPutJSON(
            `${BASE_URL}/${roomName}`,
            auth(),
            shemaFields(priority.id)
        );

        if (status !== 204) {
            throw new Error(`Jira returned status ${status} when try to add priority`);
        }

        const post = translate('setPriority', priority);
        await matrixClient.sendHtmlMessage(room.roomId, 'Successful set priority', post);

        return `Issue ${roomName} now has priority ${priority.name}`;
    } catch (err) {
        logger.error('Matrix move command error');

        throw err;
    }
};
