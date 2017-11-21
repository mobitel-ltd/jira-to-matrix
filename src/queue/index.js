/* eslint-disable no-negated-condition */
const bot = require('../bot');
const {features} = require('../config');
const logger = require('debug')('queue');
const colors = require('colors/safe');

// Обработчик хуков Jira, производит действие в зависимости от наличия body и client 
const handler = async (body, client, queue) => {
    try {
        logger(`Handler data: body => ${body}, client => ${client}, queue => ${queue}`);
        // Парсинг JSON данных
        const parsedBody = bot.parse(body);
        // logger('parsedBody', parsedBody);
        const req = {
            ...parsedBody,
            mclient: await client,
        };
        // Сохранение в Redis
        await bot.save(req);
        // const ignore = await bot.stopIf(req);
        // Проверка на игнор
        bot.isIgnore(req);
        // if (ignore) {
        //     return true;/// Зачем?
        // }
        if (features.createRoom) {
            await bot.createRoom(req);
            await bot.postIssueDescription(req);
        }
        if (features.postIssueUpdates) {
            await bot.postIssueUpdates(req);
        }
        if (features.inviteNewMembers) {
            await bot.inviteNewMembers(req);
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
        logger(colors.red(`Ups! Something went wrong:`));
        const isIgnoreErr = (err.message === 'User ignored');

        if ((err.message !== body.errMessage)) {
            logger(err);
            const newBody = {...body, errMessage: err.message};
            if (!isIgnoreErr) {
                queue.unshift(newBody);
            }
        } else {
            logger(colors.red(`Remove hook '${body.webhookEvent}' \nwith error: ${err}`));
        }

        // logger(err.message === 'User ignored');
        return isIgnoreErr;
    }
};

module.exports = {
    handler,
    queue: [],
};
