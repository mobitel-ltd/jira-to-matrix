// const R = require('ramda')
const jira = require('../jira')
const { helpers } = require('../matrix')
const logger = require('simple-color-logger')()

async function create(client, issue) {
    if (!client) {
        return undefined;
    }
    const participants = (await jira.issue.collectParticipants(issue)).map(
        helpers.userID
    );

    const options = {
        room_alias_name: issue.key,
        invite: participants,
        name: helpers.composeRoomName(issue),
        topic: jira.issue.ref(issue.key),
    };

    const response = await client.createRoom(options);
    if (!response) {
        return undefined;
    }
    logger.info(`Created room for ${issue.key}: ${response.room_id}`);
    return response.room_id;
}

// const shouldCreateRoom = R.allPass([
//     R.is(Object),
//     R.propEq('webhookEvent', 'jira:issue_created'),
//     R.propIs(Object, 'issue'),
// ])

const shouldCreateRoom = (body) => Boolean(
    typeof body === 'object'
    // && body.webhookEvent === 'jira:issue_created'
    && typeof body.issue === 'object'
)

async function middleware(req, res, next) {
    if (shouldCreateRoom(req.body)) {
        const issueID = jira.issue.extractID(JSON.stringify(req.body));
        const issue = await jira.issue.getFormatted(issueID);

        if (issue) {
            logger.info(`issue: ${Object.keys(issue)}`);
            const room = await req.mclient.getRoomId(issue.key);
            if (!room) {
                req.newRoomID = await create(req.mclient, req.body.issue);
            }
        } else {
            logger.info(`issue is  ${issue}`);
        }
    }
    next();
}

module.exports.middleware = middleware;
module.exports.forTests = {shouldCreateRoom};
