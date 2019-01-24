const getMessage = obj =>
    Object.entries(obj)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');

module.exports = {
    noJiraConnection: 'No connection with Jira!!!',

    getRequestErrorLog: (url, status, {method, body} = {method: 'GET'}) =>
        `Error in ${method} request ${url}, status is ${status}, body is ${body}`,

    getNoRoomByAliasLog: key => `Matrix not return room for key ${key} in inviteNewMembers`,

    getWatcherAddedLog: (name, roomName) => `User ${name} was added in watchers for issue ${roomName}`,

    getWatcherNotAddedLog: name => `Watcher "${name}" isn't found`,

    getAssigneeNotAddedLog: (name, roomName) => `User ${name} or issue ${roomName} is not exist`,

    getAssigneeAddedLog: (name, roomName) => `The user ${name} is assigned to issue ${roomName}`,

    getNoIssueLinkLog: (id1, id2) => `Cannot get no one issue to info about deleting link with issues: ${id1} ${id2}`,

    getWebhookStatusLog: ({userStatus, projectStatus}) => `${getMessage(userStatus)}\n${getMessage(projectStatus)}`,

    getModeratorAddLog: (sender, roomName) => `User ${sender} became a moderator for room ${roomName}`,

    getMoveSuccessLog: issue => `Issue ${issue} changed status`,

    getCommentSuccessSentLog: (sender, roomName) => `Comment from ${sender} for ${roomName} sent`,

    getCommentFailSentLog: (sender, roomName) => `Comment from ${sender} for ${roomName} not published`,

    getUpdatedIssuePriorityLog: (roomName, priority) => `Issue ${roomName} now has priority ${priority}`,

    getNotFoundPrioCommandLog: (roomName, priority) => `Not found ${priority} in issue ${roomName}`,
};
