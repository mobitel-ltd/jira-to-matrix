const schemaComment = (sender, message) => {
    const body = `[~${sender}]:\n${message}`;
    return JSON.stringify({body});
};

const schemaAssignee = assignee => JSON.stringify({'name': `${assignee}`});

const schemaWatcher = watcher => `"${watcher}"`;
/* eslint-disable comma-dangle */
const schemaMove = id => JSON.stringify({
    'transition': {
        id
    }
});

const shemaFields = id => JSON.stringify({
    'fields': {
        'priority': {
            id
        }
    }
});

module.exports = {
    schemaComment,
    schemaAssignee,
    schemaWatcher,
    schemaMove,
    shemaFields,
};
