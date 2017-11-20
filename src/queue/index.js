/* eslint-disable no-negated-condition */
const bot = require('../bot');
const {features} = require('../config');
const logger = require('debug')('queue');

// Обработчик хуков Jira, производит действие в зависимости от наличия body и client 
const handler = async (body, client, queue) => {
    try {
        const req = {
            body,
            mclient: await client,
        };
        // Парсинг JSON данных
        await bot.parse(req);
        await bot.save(req);
        const ignore = await bot.stopIf(req);
        if (ignore) {
            return true;
        }
        if (features.createRoom) {
            await bot.createRoom(req);
            await bot.postIssueDescription(req);
        }
        if (features.postIssueUpdates) {
            await bot.postIssueUpdates(req);
        }
        if (features.inviteNewMembers) {
            await bot.inviteNew(req);
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
        if (body.issue) {
            logger(`Successful processing of the hook for ${body.issue.key}`);
        } else {
            logger(`Successful processing`);
        }

        return true;
    } catch (err) {
        logger(`Ups! Something went wrong:`);

        if (err.message !== body.errMessage) {
            logger(err);
            body.errMessage = err.message;
            queue.unshift(body);
        } else {
            logger(`Remove hook '${body.webhookEvent}' \nwith error: ${err}`);
        }

        return false;
    }
};

module.exports = {
    handler,
    queue: [],
};
