const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./modules/log.js')(module);
const getParsedAndSaveToRedis = require('./jira-hook-parser');
const { getAllSettingData, setSettingsData, delSettingsData } = require('./bot/settings');
const { httpStatus } = require('./lib/utils');

const app = express();

module.exports = handleFunc => {
    app.use(
        bodyParser.json({
            strict: false,
            limit: '20mb',
        }),
    )
        .post('/', async (req, res, next) => {
            logger.info('Webhook received! Start getting ignore status');
            logger.silly('Jira body', req.body);

            const saveStatus = await getParsedAndSaveToRedis(req.body);

            if (saveStatus) {
                await handleFunc();
            }

            next();
        })
        .get('/', (req, res) => {
            res.end(`Version ${process.env.npm_package_version}`);
        })
        .post('/run', async (req, res, next) => {
            logger.info('Run handling queue');

            await handleFunc();

            next();
        })
        .get('/ignore', async (req, res) => {
            try {
                const result = (await getAllSettingData('ignore')) || 'Ignore list is empty.';
                res.json(result).end();
            } catch (err) {
                logger.error(err);
                res.status(httpStatus.BAD_REQUEST).end();
            }
        })
        .post('/ignore', async (req, res) => {
            const [ignoreData] = Object.entries(req.body);
            try {
                const [key, data] = ignoreData;
                await setSettingsData(key, data, 'ignore');
                res.end();
            } catch (err) {
                logger.error(err);
                res.status(httpStatus.BAD_REQUEST).end();
            }
        })
        .put('/ignore/:key', async (req, res) => {
            const { key } = req.params;
            const data = req.body;
            try {
                await setSettingsData(key, data, 'ignore');
                res.end();
            } catch (err) {
                logger.error(err);
                res.status(httpStatus.BAD_REQUEST).end();
            }
        })
        .delete('/ignore/:key', async (req, res) => {
            const { key } = req.params;
            try {
                await delSettingsData(key, 'ignore');
                res.end();
            } catch (err) {
                logger.error(err);
                res.status(httpStatus.BAD_REQUEST).end();
            }
        })
        .use((req, res) => {
            res.end();
        })
        .use((err, req, res, next) => {
            if (err) {
                logger.error(err);
            }
            res.end();
        });

    return app;
};
