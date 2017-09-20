const {features} = require('../config');
const parse = require('./parse-incoming');
const save = require('./save-incoming');
const stopIf = require('./stop-if-user-ignored');
const connectToMatrix = require('./connect-to-matrix');
const createRoom = require('./create-room').middleware;
const postIssueDescription = require('./post-issue-description');
const inviteNew = require('./invite-new-members').middleware;
const postComment = require('./post-comment').middleware;
const postIssueUpdates = require('./post-issue-updates').middleware;
const postEpicUpdates = require('./post-epic-updates').middleware;
const postProjectUpdates = require('./post-project-updates');
const postNewLinks = require('./post-new-links');
const postLinkedChanges = require('./post-linked-changes');

function createApp(express) {
    const app = express.Router();
    app.use(parse);
    app.use(save);
    app.use(stopIf);
    // app.use(connectToMatrix);
    if (features.createRoom) {
        app.use(createRoom);
        app.use(postIssueDescription);
    }
    if (features.inviteNewMembers) {
        app.use(inviteNew);
    }
    if (features.postIssueUpdates) {
        app.use(postIssueUpdates);
    }
    if (features.postComments) {
        app.use(postComment);
    }
    if (features.epicUpdates.on()) {
        app.use(postEpicUpdates);
        app.use(postProjectUpdates);
    }
    if (features.newLinks) {
        app.use(postNewLinks);
    }
    if (features.postChangesToLinks.on) {
        app.use(postLinkedChanges);
    }
    return app;
}

module.exports.createApp = createApp;
