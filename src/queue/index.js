/* eslint-disable no-negated-condition */
const bot = require('../bot');
const logger = require('debug')('queue');
const colors = require('colors/safe');
const {getBotFunc} = require('./bot-handler');

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

        const funcArr = getBotFunc(req.body);
        if (req.mclient) {
            const allResult = await Promise.all(funcArr.map(async func => {
                logger('bot[func]', func);
                await bot[func](req);
                return true;
            }));
            logger('allResult', allResult);
        }

        if (body.issue) {
            logger(colors.green(`Successful processing of the hook for ${body.issue.key}`));
        } else {
            logger(colors.green(`Successful processing`));
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
