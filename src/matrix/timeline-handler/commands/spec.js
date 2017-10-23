const jiraRequest = require('../../../utils');
const {auth} = require('../../../jira');
const translate = require('../../../locales');
const {domain} = require('../../../config').matrix;
const {searchUser, BASE_URL} = require('./helper.js');
const {schemaWatcher} = require('./schemas.js');

const addUserInWatchers = async (room, roomName, user, self) => {
    const post = translate('successWatcherJira');
    self.sendHtmlMessage(room.roomId, post, post);

    let userId = `@${user}:${domain}`;
    const members = room.getJoinedMembers();
    members.forEach(member => {
        if (member.userId === userId) {
            userId = null;
        }
    });

    if (userId) {
        await self.invite(room.roomId, userId);
    }

    return `User ${user} was added in watchers for issue ${roomName}`;
};

module.exports = async ({body, room, roomName, self}) => {
    const user = body.substring(6).trim();

    let jiraWatcher = await jiraRequest.fetchPostJSON(
        `${BASE_URL}/${roomName}/watchers`,
        auth(),
        schemaWatcher(user)
    );

    let inviteMessage;
    if (jiraWatcher.status !== 204) {
        const users = await searchUser(user);
        let post;
        switch (users.length) {
            case 0:
                post = translate('errorWatcherJira');
                self.sendHtmlMessage(room.roomId, post, post);
                return `Watcher ${user} don't add in ${roomName} issue`;
            case 1:
                jiraWatcher = await jiraRequest.fetchPostJSON(
                    `${BASE_URL}/${roomName}/watchers`,
                    auth(),
                    schemaWatcher(users[0].name)
                );
                if (jiraWatcher.status !== 204) {
                    post = translate('errorWatcherJira');
                    self.sendHtmlMessage(room.roomId, post, post);
                    return `Watcher ${users[0].name} don't add in ${roomName} issue`;
                }
                inviteMessage = await addUserInWatchers(room, roomName, users[0].name, self);
                return inviteMessage;
            default:
                post = users.reduce(
                    (prev, cur) => `${prev}<strong>${cur.name}</strong> - ${cur.displayName}<br>`,
                    'List users:<br>');

                await self.sendHtmlMessage(room.roomId, 'List users', post);
                return;
        }
    }

    inviteMessage = await addUserInWatchers(room, roomName, user, self);
    return inviteMessage;
};
