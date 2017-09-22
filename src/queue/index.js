const bot = require('../bot');
const {features} = require('../config');
const logger = require('simple-color-logger')();

async function handler(body, client, queue) {
    try {
        const req = {
            body,
            mclient: await client,
        };

        await bot.parse(req);
        await bot.save(req);
        const ignore = await bot.stopIf(req);
        if (ignore) {
            return;
        }

        if (features.createRoom) {
            await bot.createRoom(req);
            await bot.postIssueDescription(req);
        }
        if (features.inviteNewMembers) {
            await bot.inviteNew(req);
        }
        if (features.postIssueUpdates) {
            await bot.postIssueUpdates(req);
        }
        if (features.postComments) {
            await bot.postComment(req);
        }
        if (features.epicUpdates.on()) {
            await bot.postEpicUpdates(req);
            await bot.postProjectUpdates(req);
        }
        if (features.newLinks) {
            await bot.postNewLinks(req);
        }
        if (features.postChangesToLinks.on) {
            await bot.postLinkedChanges(req);
        }
        logger.info(`Successful processing of the hook for ${body.key}`);

        return true;
    } catch (err) {
        logger.error(`Ups! Something went wrong: ${err}`);
        queue.push(body);
        return false;
    }
}

module.exports = {
    handler,
    queue: [],
};
