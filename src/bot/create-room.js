const R = require('ramda')
const jira = require('../jira')
const { helpers } = require('../matrix')
const logger = require('simple-color-logger')()

async function create(client, issue) {
    if (!client) {
        return undefined
    }
    const participants = (await jira.issue.collectParticipants(issue)).map(
    helpers.userID
  )

    const options = {
        room_alias_name: issue.key,
        invite: participants,
        name: helpers.composeRoomName(issue),
        topic: jira.issue.ref(issue.key),
    }

    const response = await client.createRoom(options)
    if (!response) {
        return undefined
    }
    logger.info(`Created room for ${issue.key}: ${response.room_id}`)
    return response.room_id
}

const shouldCreateRoom = R.allPass([
    R.is(Object),
    R.propEq('webhookEvent', 'jira:issue_created'),
    R.propIs(Object, 'issue'),
])

async function middleware(req, res, next) {
    logger.info(`Создать комнату: ${shouldCreateRoom(req.body)} \n`)
    if (shouldCreateRoom(req.body)) {
        req.newRoomID = await create(req.mclient, req.body.issue)
    }
    next()
}

module.exports.middleware = middleware
module.exports.forTests = { shouldCreateRoom }
