const _ = require('lodash')
const htmlToText = require('html-to-text').fromString
const jira = require('../jira')

function getTextIssue(req, address) {
    const text = String(
        _.get(req.body.issue.fields, address) || ''
    ).trim()

    if (!text) {
        return 'отсутствует'
    }

    return text
}

function getPost(req) {
    const assigneeName = getTextIssue(req, 'assignee.displayName')
    const assigneeEmail = getTextIssue(req, 'assignee.emailAddress')
    const reporterName = getTextIssue(req, 'reporter.displayName')
    const reporterEmail = getTextIssue(req, 'reporter.emailAddress')
    const epicLink = getTextIssue(req, 'customfield_10006')
    const estimateTime = getTextIssue(req, 'reporter.timeestimate')
    const description = getTextIssue(req, 'description')

    const post = `
        Assignee: 
            <br>&nbsp;&nbsp;&nbsp;&nbsp;${assigneeName}
            <br>&nbsp;&nbsp;&nbsp;&nbsp;${assigneeEmail}<br>
        <br>Reporter: 
            <br>&nbsp;&nbsp;&nbsp;&nbsp;${reporterName}
            <br>&nbsp;&nbsp;&nbsp;&nbsp;${reporterEmail}<br>
        <br>Epic link: 
            <br>&nbsp;&nbsp;&nbsp;&nbsp;\thttps://jira.bingo-boom.ru/jira/browse/${epicLink}<br>
        <br>Estimate time: 
            <br>&nbsp;&nbsp;&nbsp;&nbsp;${estimateTime}<br>
        <br>Description: 
            <br>&nbsp;&nbsp;&nbsp;&nbsp;${description}<br>
        `

    return post
}

async function middleware(req, res, next) {
    if (req.newRoomID && req.mclient) {
        const post = getPost(req)
        const { issue } = req.body
        const formatted = Object.assign(
            {},
            { post },
            await jira.issue.renderedValues(issue.id, ['description'])
        )
        await req.mclient.sendHtmlMessage(
            req.newRoomID,
            htmlToText(formatted),
            formatted.post
        )
    }
    next()
}

module.exports = middleware
