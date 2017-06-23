const _ = require('lodash')
const jira = require('../jira')
const logger = require('simple-color-logger')()

function parse(req, res, next) {
    if (typeof req.body !== 'object' || _.isEmpty(req.body)) {
        return
    }

    const json = JSON.stringify(req.body, null, 2)
    const issue = _.get(req.body, 'issue.key') || jira.issue.extractID(json)

    const user =
    _.get(req.body, 'user.name') || _.get(req.body, 'comment.author.name')

    const key = [
        req.body.timestamp,
        (req.body.webhookEvent || '').replace(':', '-'),
        user,
        issue,
        'queued',
    ]
    .map(v => v || 'null')
    .join('|')

    logger.fyi(`Incoming: ${key}`)

    req.jiraKey = key
    req.formattedJSON = json
    next()
}

module.exports = parse
