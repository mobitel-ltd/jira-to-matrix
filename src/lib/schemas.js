module.exports = {
    comment: (sender, message) => {
        const body = `[~${sender}]:\n${message}`;
        return JSON.stringify({ body });
    },

    assignee: accountId => JSON.stringify({ accountId }),

    watcher: watcher => `"${watcher}"`,

    move: transition => JSON.stringify({ transition }),

    fields: id =>
        JSON.stringify({
            update: {
                priority: [
                    {
                        set: {
                            id,
                        },
                    },
                ],
            },
        }),
    issueNotChild: (summary, issueTypeId, projectId) =>
        JSON.stringify({
            fields: {
                summary,
                issuetype: {
                    id: issueTypeId,
                },
                project: {
                    id: projectId,
                },
            },
        }),
    issueChild: (summary, issueTypeId, projectId, parentId) =>
        JSON.stringify({
            fields: {
                summary,
                issuetype: {
                    id: issueTypeId,
                },
                project: {
                    id: projectId,
                },
                parent: { key: parentId },
            },
        }),
    issueEpicLink: parentId =>
        JSON.stringify({
            fields: {
                customfield_10013: parentId,
            },
        }),
    issueLink: (issueKey1, issueKey2) =>
        JSON.stringify({
            outwardIssue: {
                key: issueKey1,
            },
            inwardIssue: {
                key: issueKey2,
            },
            type: {
                name: 'Relates',
            },
        }),
};
