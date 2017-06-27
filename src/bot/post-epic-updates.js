const R = require('ramda')
const to = require('await-to-js').default
const logger = require('simple-color-logger')()
const marked = require('marked')
const { t } = require('../locales')
const redis = require('../redis-client')
const jira = require('../jira')
const { fp } = require('../utils')
const { shouldPostChanges } = require('./post-issue-updates')
const { epicUpdates: epicConf } = require('../config').features

const getEpicKey = (issue, field) => R.path(['fields', field], issue)

const epicRedisKey = epicID => `epic|${epicID}`

async function isInEpic(epicID, issueID) {
    const [err, saved] = await to(
        redis.sismemberAsync(epicRedisKey(epicID), issueID)
    )
    if (err) {
        logger.error(`Error while querying redis:\n${err.message}`)
        return undefined
    }
    return saved
}

async function saveToEpic(epicID, issueID) {
    const [err] = await to(
        redis.saddAsync(epicRedisKey(epicID), issueID)
    )
    if (err) {
        logger.error(`Redis error while adding issue to epic :\n${err.message}`)
    }
}

async function sendMessageNewIssue(mclient, epic, newIssue) {
    const roomID = await mclient.getRoomId(epic.key)
    if (!roomID) {
        return undefined
    }
    const values = fp.paths([
        'epic.fields.summary',
        'issue.key',
        'issue.fields.summary',
    ], { epic, issue: newIssue })
    values['epic.ref'] = jira.issue.ref(epic.key)
    values['issue.ref'] = jira.issue.ref(newIssue.key)
    const success = await mclient.sendHtmlMessage(
        roomID,
        t('newIssueInEpic'),
        marked(t('issueAddedToEpic', values))
    )
    return success
}

async function postNewIssue(epic, issue, mclient) {
    const saved = await isInEpic(epic.id, issue.id)
    if (saved) {
        return
    }
    const success = await sendMessageNewIssue(mclient, epic, issue)
    if (success) {
        logger.info(`Notified epic ${epic.key} room about issue ${issue.key} added to epic "${epic.fields.summary}"`)
        await saveToEpic(epic.id, issue.id)
    }
}

async function postEpicUpdates({ mclient, body }) {
    const { issue } = body
    const epicKey = getEpicKey(issue, epicConf.field)
    if (!epicKey) {
        return
    }
    const epic = await jira.issue.get(epicKey)
    if (!epic) {
        return
    }

    if (epicConf.newIssuesInEpic === 'on') {
        await postNewIssue(epic, issue, mclient)
    }
}

async function middleware(req, res, next) {
    if (shouldPostChanges(req) && epicConf.on()) {
        await postEpicUpdates(req)
    }
    next()
}

module.exports = middleware
