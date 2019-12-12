module.exports = {
    comment: (sender, message) => {
        const body = `[~${sender}]:\n${message}`;
        return JSON.stringify({ body });
    },

    assignee: name => JSON.stringify({ name }),

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
    issue: props => JSON.stringify({ fields: { ...props } }),
    issueEpicLink: props => JSON.stringify({ ...props }),
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
