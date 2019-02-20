const jiraRequests = require('../../../lib/jira-request');
const utils = require('../../../lib/utils.js');

const helper = {
    getInviteUser: (name, room) => {
        const user = utils.getChatUserId(name);

        return helper.isMember(room, user) ? false : user;
    },

    isMember: (room, userIdMatrix) => {
        const members = room.getJoinedMembers();
        return members.some(({userId}) => userId === userIdMatrix);
    },

    // Checking occurrences of current name
    checkUser: ({name, displayName}, expectedName) =>
        name.toLowerCase().includes(expectedName.toLowerCase())
        || displayName.toLowerCase().includes(expectedName.toLowerCase()),

    // Search users by part of name
    searchUser: async name => {
        if (!name) {
            return [];
        }
        const allUsers = await jiraRequests.getUsersByParam(name);

        return allUsers.reduce((prev, cur) =>
            (helper.checkUser(cur, name) ? [...prev, cur] : prev),
        []);
    },

    // Parse body of event from Matrix
    parseEventBody: body => {
        try {
            const trimedBody = body.trim();

            const commandName = trimedBody
                .split(' ')[0]
                .match(/^!\w+$/g)[0]
                .substring(1);

            if (`!${commandName}` === trimedBody) {
                return {commandName};
            }

            const bodyText = trimedBody
                .replace(`!${commandName}`, '')
                .trim();

            return {commandName, bodyText};
        } catch (err) {
            return {};
        }
    },

    addToWatchers: async (room, roomName, name, chatApi) => {
        try {
            await jiraRequests.addWatcher(name, roomName);
            const inviteUser = helper.getInviteUser(name, room);

            if (inviteUser) {
                await chatApi.invite(room.roomId, inviteUser);
            }
        } catch (err) {
            throw utils.errorTracing('addToWatchers', err);
        }
    },

    addToAssignee: async (room, roomName, name, chatApi) => {
        try {
            await jiraRequests.addAssignee(name, roomName);
            const inviteUser = helper.getInviteUser(name, room);
            if (inviteUser) {
                await chatApi.invite(room.roomId, inviteUser);
            }
        } catch (err) {
            throw utils.errorTracing('addToAssignee', err);
        }
    },
};

module.exports = helper;
