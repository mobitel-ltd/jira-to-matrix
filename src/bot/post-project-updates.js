const {t} = require('../locales');
const marked = require('marked');
const jira = require('../jira');

async function postProjectUpdates({mclient, body}) {
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
        await epicChanged(roomId,mclient, body);
    }
}

async function epicChanged(roomId, mclient, body) {
    const values = {
        'user.name': body.user.name,
        'issue.key': body.issue.key,
        'issue.fields.summary': body.issue.fields.summary,
        'status': body.issue.fields.status.name,
    };
    values['issue.ref'] = jira.issue.ref(body.issue.key);


    await mclient.sendHtmlMessage(
        roomId,
        t('statusEpicChanged', values),
        marked(t('statusEpicChangedMessage', values, values['user.name']))
    );
}

async function newEpic(roomId, mclient, issue) {
    const values = {
        'issue.key': issue.key,
        'issue.fields.summary': issue.fields.summary,
    }; 
    values['issue.ref'] = jira.issue.ref(issue.key);

    await mclient.sendHtmlMessage(
        roomId,
        t('newEpicInProject', ),
        marked(t('epicAddedToProject', values, values['user.name']))
    );
}

const shouldPostChanges = (body) => Boolean(
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
)


async function middleware(req) {
    if (shouldPostChanges(req.body)) {
        await postProjectUpdates(req);
    }
}

module.exports = middleware;