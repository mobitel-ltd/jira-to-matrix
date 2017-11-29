const translate = require('../locales');
const marked = require('marked');
const jira = require('../jira');


const epicChanged = async (roomId, mclient, body) => {
    const values = {
        'user.name': body.user.name,
        'issue.key': body.issue.key,
        'issue.fields.summary': body.issue.fields.summary,
        'status': body.issue.fields.status.name,
    };
    values['issue.ref'] = jira.issue.ref(body.issue.key);

    await mclient.sendHtmlMessage(
        roomId,
        translate('statusEpicChanged', values),
        marked(translate('statusEpicChangedMessage', values, values['user.name']))
    );
};

const newEpic = async (roomId, mclient, issue) => {
    const values = {
        'issue.key': issue.key,
        'issue.fields.summary': issue.fields.summary,
    };
    values['issue.ref'] = jira.issue.ref(issue.key);

    await mclient.sendHtmlMessage(
        roomId,
        translate('newEpicInProject'),
        marked(translate('epicAddedToProject', values, values['user.name']))
    );
};

const shouldPostChanges = body =>
    Boolean(
        typeof body === 'object'
        && (
            body.webhookEvent === 'jira:issue_updated'
            || (body.webhookEvent === 'jira:issue_created')
        )
        && typeof body.issue === 'object'
        && typeof body.issue.fields === 'object'
        && body.issue.fields.issuetype.name === 'Epic'
        && (
            body.issue_event_type_name === 'issue_generic'
            || body.issue_event_type_name === 'issue_created'
        )
    );

const postProjectUpdatesLogic = async ({mclient, body}) => {
    const typeEvent = body.issue_event_type_name;
    const projectOpts = body.issue.fields.project;
    if (!projectOpts) {
        return;
    }

    const roomId = await mclient.getRoomId(projectOpts.key);
    if (!roomId) {
        return;
    }

    if (typeEvent === 'issue_created') {
        await newEpic(roomId, mclient, body.issue);
    }

    if (typeEvent === 'issue_generic') {
        await epicChanged(roomId, mclient, body);
    }
};

const postProjectUpdates = async req => {
    if (shouldPostChanges(req.body)) {
        await postProjectUpdatesLogic(req);
    }
};

module.exports = {postProjectUpdates};
