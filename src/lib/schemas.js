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
};
