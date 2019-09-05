const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./modules/log.js')(module);
const getParsedAndSaveToRedis = require('./jira-hook-parser');

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
