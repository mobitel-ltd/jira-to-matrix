const jiraRequests = require('../../../lib/jira-request');
const translate = require('../../../locales');
const {checkNamePriority} = require('./helper.js');

module.exports = async ({bodyText, room, roomName, matrixClient}) => {
    try {
        const priorities = await jiraRequests.getIssuePriorities(roomName);

        if (!priorities) {
            throw new Error(`Jira not return list priorities for ${roomName}`);
        }

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

        await jiraRequests.updateIssuePriority(roomName, priority.id);

        const post = translate('setPriority', priority);
        await matrixClient.sendHtmlMessage(room.roomId, 'Successful set priority', post);

        return `Issue ${roomName} now has priority ${priority.name}`;
    } catch (err) {
        throw ['Matrix prio command error', err].join('\n');
    }
};
