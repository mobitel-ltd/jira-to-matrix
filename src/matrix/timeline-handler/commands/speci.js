const translate = require('../../../locales');
const {searchUser, addToWatchers} = require('./helper.js');

module.exports = async ({bodyText, room, roomName, matrixClient}) => {
    try {
        const users = await searchUser(bodyText);
        switch (users.length) {
            case 0: {
                const post = translate('errorWatcherJira');
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return `Watcher "${bodyText}" isn't added to ${roomName} issue`;
            }
            case 1: {
                const [{name, displayName}] = users;

                await addToWatchers(room, roomName, name, matrixClient);

                const post = translate('successWatcherJira');
                await matrixClient.sendHtmlMessage(room.roomId, post, post);

                return `User ${displayName} was added in watchers for issue ${roomName}`;
            }
            default: {
                const post = users.reduce(
                    (prev, cur) => `${prev}<strong>${cur.name}</strong> - ${cur.displayName}<br>`,
                    'List users:<br>');

                await matrixClient.sendHtmlMessage(room.roomId, 'List users', post);

                return;
            }
        }
    } catch (err) {
        throw ['Matrix spec command error', err].join('\n');
    }
};
