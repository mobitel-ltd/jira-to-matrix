const _ = require('lodash');
const jira = require('../jira');
const logger = require('debug')('parse');

module.exports = body => {
    if (typeof body !== 'object' || _.isEmpty(body)) {
        logger('unexpected body');
        throw new Error('unexpected body in Jira webhook');
    }
    const json = JSON.stringify(body, null, 2);
    const issue = _.get(body, 'issue.key') || jira.issue.extractID(json);

    const user =
    _.get(body, 'user.name') || _.get(body, 'comment.author.name');

    const key = [
        body.timestamp,
        (body.webhookEvent || '').replace(':', '-'),
        user,
        issue,
        'queued',
    ]
        .map(value => value || 'null')
        .join('|');

    logger(`Incoming: ${key}`);

    return {
        body,
        jiraKey: key,
        formattedJSON: json,
    };
};
