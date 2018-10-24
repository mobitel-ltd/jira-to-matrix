const schemaComment = (sender, message) => {
    const body = `[~${sender}]:\n${message}`;
    return JSON.stringify({body});
};

const schemaAssignee = assignee => JSON.stringify({'name': `${assignee}`});

const schemaWatcher = watcher => `"${watcher}"`;
const schemaMove = id => JSON.stringify({
    'transition': id,
});

const shemaFields = id => JSON.stringify({
    'update': {
        {
            'priority': [{
                'set': {
                    'id': id
                },
            },],
    },
});

module.exports = {
    schemaComment,
    schemaAssignee,
    schemaWatcher,
    schemaMove,
    shemaFields,
};
