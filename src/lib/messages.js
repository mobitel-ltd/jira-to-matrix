module.exports = {
    noJiraConnection: 'No connection with Jira!!!',

    getRequestErrorLog: (url, status, {method, body} = {method: 'GET'}) =>
        `Error in ${method} request ${url}, status is ${status}, body is ${body}`,

    getNoRoomByAliasLog: key => `Matrix not return room for key ${key} in inviteNewMembers`,

    getWatcherAddedLog: (name, roomName) => `User ${name} was added in watchers for issue ${roomName}`,

    getWatcherNotAddedLog: name => `Watcher "${name}" isn't found`,
};
