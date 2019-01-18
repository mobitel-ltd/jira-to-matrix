module.exports = {
    noJiraConnection: 'No connection with Jira!!!',

    getRequestErrorLog: (url, status, {method, body} = {method: 'GET'}) =>
        `Error in ${method} request ${url}, status is ${status}, body is ${body}`,

    getNoRoomByAliasLog: key => `Matrix not return room for key ${key} in inviteNewMembers`,

    getWatcherAddedLog: (name, roomName) => `User ${name} was added in watchers for issue ${roomName}`,

    getWatcherNotAddedLog: name => `Watcher "${name}" isn't found`,

    getAssigneeNotAddedLog: (name, roomName) => `User ${name} or issue ${roomName} is not exist`,

    getAssigneeAddedLog: (name, roomName) => `The user ${name} is assigned to issue ${roomName}`,

    getNoIssueLinkLog: (id1, id2) =>
        `Cannot get no one issue to info about deleting link with issues: ${id1} ${id2}`,
};
