const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./modules/log.js')(module);
const getParsedAndSaveToRedis = require('./jira-hook-parser');
const {getIgnoreList, setIgnoreData, delIgnoreData} = require('./bot/settings');

const app = express();

module.exports = handleFunc => {
    app
        .use(bodyParser.json({
            strict: false,
            limit: '20mb',
        }))
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
        .get('/ignore', async (req, res) => {
            try {
                const result = await getIgnoreList();
                res.end(result);
            } catch (err) {
                logger.error(err);
                res.status(302);
                res.end();
            }
        })
        .post('/ignore', async (req, res) => {
            const [ignoreData] = Object.entries(req.body);
            const [key, data] = ignoreData;
            try {
                await setIgnoreData(key, data);
                res.end();
            } catch (err) {
                logger.error(err);
                res.status(302);
                res.end();
            }
        })
        .put('/ignore/:key', async (req, res) => {
            const {key} = req.params;
            const data = req.body;
            try {
                await setIgnoreData(key, data);
                res.end();
            } catch (err) {
                logger.error(err);
                res.status(302);
                res.end();
            }
        })
        .delete('/ignore/:key', async (req, res) => {
            const {key} = req.params;
            try {
                await delIgnoreData(key);
                res.end();
            } catch (err) {
                logger.error(err);
                res.status(302);
                res.end();
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
