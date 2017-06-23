const conf = require('../config')
const parse = require('./parse-incoming')
const save = require('./save-incoming')
const stopIf = require('./stop-if-user-ignored')
const connectToMatrix = require('./connect-to-matrix')
const createRoom = require('./create-room').middleware
const postIssueDescription = require('./post-issue-description')
const inviteNew = require('./invite-new-members').middleware
const postComment = require('./post-comment').middleware
const postIssueUpdates = require('./post-issue-updates').middleware

function createApp(express) {
    const app = express.Router()
    app.use(parse)
    app.use(save)
    app.use(stopIf)
    app.use(connectToMatrix)
    if (conf.features.createRoom) {
        app.use(createRoom)
        app.use(postIssueDescription)
    }
    if (conf.features.inviteNewMembers) {
        app.use(inviteNew)
    }
    if (conf.features.postIssueUpdates) {
        app.use(postIssueUpdates)
    }
    if (conf.features.postComments) {
        app.use(postComment)
    }
    return app
}

module.exports.createApp = createApp
