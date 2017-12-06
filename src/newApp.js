const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const EventEmitter = require('events');
const conf = require('./config');
const matrix = require('./matrix');
const logger = require('debug')('app');
const getParsedAndSaveToRedis = require('../src/queue/get-parsed-and-save-to-redis.js');
const newQueueHandler = require('../src/queue/new-queue-handler.js');

// const {getFuncAndBody} = require('./src/queue/bot-handler.js');

const queuePush = new EventEmitter();
const {connect, disconnect} = matrix;

const connectToMatrix = async matrix => {
    logger('Matrix connection');
    const client = await connect();
    return client;
};

const client = connectToMatrix(matrix);

const app = express();

app.use(bodyParser.json({
    strict: false,
    limit: '20mb',
}));

// POST для Jira, добавляет задачи для последующей обработки
app.post('/', async (req, res, next) => {
    logger('Jira body', req.body);
    const saveStatus = await getParsedAndSaveToRedis(req.body);

    if (saveStatus) {
        queuePush.emit('notEmpty');
    }

    next();
});

// version, to verify deployment
app.get('/', (req, res) => {
    res.end(`Version ${conf.version}`);
});
// end any request for it not to hang
app.use((req, res) => {
    res.end();
});

app.use((err, req, res, next) => {
    if (err) {
        logger('express error', err);
    }
    res.end();
});

const server = http.createServer(app);
server.listen(conf.port, () => {
    logger(`Server is listening on port ${conf.port}`);
});

queuePush.on('notEmpty', async () => {
    logger('queuePush start');
    if (client) {
        await newQueueHandler(client);
    }
});

const onExit = async function onExit() {
    const disconnection = await disconnect();
    disconnection();
    if (server.listening) {
        server.close(() => {
            process.exit();
        });
        return;
    }
    process.exit();
};

process.on('exit', onExit);
