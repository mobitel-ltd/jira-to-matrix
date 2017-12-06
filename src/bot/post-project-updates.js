const translate = require('../locales');
const marked = require('marked');
const jira = require('../jira');
const logger = require('debug')('post-issue-updates');

const epicChanged = async (roomId, mclient, data) => {
    const values = {
        'user.name': data.name,
        'issue.key': data.key,
        'data.fields.summary': data.fields.summary,
        'status': data.fields.status.name,
    };
    values['issue.ref'] = jira.issue.ref(data.key);

    await mclient.sendHtmlMessage(
        roomId,
        translate('statusEpicChanged', values),
        marked(translate('statusEpicChangedMessage', values, values['user.name']))
    );
};

const newEpic = async (roomId, mclient, data) => {
    const values = {
        'issue.key': data.key,
        'issue.fields.summary': data.fields.summary,
    };
    values['issue.ref'] = jira.issue.ref(data.key);

    await mclient.sendHtmlMessage(
        roomId,
        translate('newEpicInProject'),
        marked(translate('epicAddedToProject', values, values['user.name']))
    );
};

const postProjectUpdates = async ({mclient, typeEvent, projectOpts, data}) => {
    try {
        if (!projectOpts) {
            logger('No project in body.issue.fields');
            return true;
        }

        const roomId = await mclient.getRoomId(projectOpts.key);
        if (!roomId) {
            return;
        }

        if (typeEvent === 'issue_created') {
            await newEpic(roomId, mclient, data);
        }
        
        if (typeEvent === 'issue_generic') {
            await epicChanged(roomId, mclient, data);
        }
    } catch (err) {
        logger('error in postProjectUpdates');
        throw err;
    }
};

module.exports = {postProjectUpdates};
