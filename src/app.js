const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const conf = require('./config');
const matrix = require('./matrix');
const logger = require('debug')('app');
const {checkNodeVersion} = require('./utils');
const cachedQueue = require('./queue').queue;
const queueHandler = require('./queue').handler;
const EventEmitter = require('events');
const queuePush = new EventEmitter();
const fs = require('fs');

const connectToMatrix = async matrix => {
    logger('Matrix connection');
    const client = await matrix.connect();
    return client;
};

const checkQueue = () => {
    if (cachedQueue.length > 0) {
        queuePush.emit('notEmpty');
    }
};

let client = connectToMatrix(matrix);

if (!checkNodeVersion()) {
    process.exit(1);
}

process.on('uncaughtException', err => {
    if (err.errno === 'EADDRINUSE') {
        logger(`Port ${conf.port} is in use!\n${err}`);
    } else {
        logger(`Uncaught exception!\n${err}`);
    }
    process.exit(1);
});

const app = express();

app.use(bodyParser.json({
    strict: false,
    limit: '20mb',
}));

// POST для Jira, добавляет задачи для последующей обработки
app.post('/', (req, res, next) => {
    const name = Math.floor(Math.random() * 11);
    fs.writeFileSync(`/tmp/jira${name}.json`, JSON.stringify(req.body));
    logger('Jira body', req.body);
    cachedQueue.push(req.body);
    if (!client) {
        next(new Error('Matrix client is not exist'));
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

const checkingQueueInterval = setInterval(checkQueue, 500);
checkingQueueInterval.unref();

queuePush.on('notEmpty', async () => {
    logger('queuePush start');
    let success;
    if (client) {
        const lastReq = cachedQueue.pop();
        // Обработка массива вебхуков от Jira
        success = await queueHandler(lastReq, client, cachedQueue);
    }
    logger('success', success);
    if (!success && client) {
        client = null;
        client = await connectToMatrix(matrix);
    }
});

const onExit = async function onExit() {
    const disconnection = await matrix.disconnect();
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
process.on('SIGINT', onExit);
process.on('uncaughtException', onExit);
