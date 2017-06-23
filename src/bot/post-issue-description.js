const _ = require('lodash')
const htmlToText = require('html-to-text').fromString
const jira = require('../jira')

async function middleware(req, res, next) {
    const description = String(
    _.get(req, 'body.issue.fields.description') || ''
  ).trim()
    if (req.newRoomID && description && req.mclient) {
        const { issue } = req.body
        const formatted = Object.assign(
      {},
      { description },
      await jira.issue.renderedValues(issue.id, ['description'])
    )
        await req.mclient.sendHtmlMessage(
      req.newRoomID,
      htmlToText(description),
      formatted.description
    )
    }
    next()
}

module.exports = middleware
