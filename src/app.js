const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const EventEmitter = require('events');

const conf = require('./config');
const Matrix = require('./matrix');
const logger = require('./modules/log.js')(module);
const getParsedAndSaveToRedis = require('../src/queue/get-parsed-and-save-to-redis.js');
const newQueueHandler = require('../src/queue');

const queuePush = new EventEmitter();

const connectToMatrix = () => (async () => {
    const connection = await Matrix.connect();

    queuePush.emit('startQueueHandler');
    return connection;
})();

const tryRedis = () =>
    setInterval(() => queuePush.emit('startQueueHandler'), 30 * 60 * 1000);


const client = connectToMatrix();
tryRedis();

const app = express();

app.use(bodyParser.json({
    strict: false,
    limit: '20mb',
}));

app.post('/', async (req, res, next) => {
    logger.silly('Jira body', req.body);

    // return false if user in body is ignored
    const saveStatus = await getParsedAndSaveToRedis(req.body);

    if (saveStatus) {
        queuePush.emit('startQueueHandler');
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
        logger.error(err);
    }
    res.end();
});

const server = http.createServer(app);
server.listen(conf.port, () => {
    logger.info(`Server is listening on port ${conf.port}`);
});

tryRedis();

queuePush.on('startQueueHandler', async () => {
    logger.info('queuePush start');
    if (client) {
        await newQueueHandler(client);
    }
});

const onExit = () => {
    clearInterval(tryRedis());
    Matrix.disconnect();
    if (server.listening) {
        server.close(() => {
            process.exit();
        });

        return;
    }
    process.exit();
};

process.on('uncaughtException', err => {
    if (err.errno === 'EADDRINUSE') {
        logger.warn(`Port ${conf.port} is in use!\n${err}`);
    } else {
        logger.error(`Uncaught exception!\n${err}`);
    }
    process.exit(1);
});

process.on('exit', onExit);
process.on('SIGINT', onExit);
process.on('uncaughtException', onExit);
