const getMessage = obj =>
    Object.entries(obj)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');

module.exports = {
    infoBody: `
    <br>
    Use <font color="green"><strong>!help</strong></font> in chat for give info for jira commands
    `,

    noJiraConnection: 'No connection with Jira!!!',

    getRequestErrorLog: (url, status, {method, body} = {method: 'GET'}) =>
        `Error in ${method} request ${url}, status is ${status}, body is ${body}`,

    getNoIssueLinkLog: (id1, id2) => `Cannot get no one issue to info about deleting link with issues: ${id1} ${id2}`,

    getWebhookStatusLog: ({userStatus, projectStatus}) => `${getMessage(userStatus)}\n${getMessage(projectStatus)}`,
};
