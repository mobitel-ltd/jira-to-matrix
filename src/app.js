const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const EventEmitter = require('events');
const StateMachine = require('javascript-state-machine');
const StateMachineHistory = require('javascript-state-machine/lib/history');
const timelineHandler = require('./timeline-handler');

const conf = require('./config');
const getLogger = require('./modules/log.js');
const logger = getLogger(module);
const getParsedAndSaveToRedis = require('./jira-hook-parser');
const queueHandler = require('../src/queue');
const Matrix = require('matrix-sdk-fasade');

const chatApi = new Matrix({config: conf.matrix, timelineHandler, logger: getLogger});

const CHECK_QUEUE_DELAY = 30 * 60 * 1000;
const queuePush = new EventEmitter();

const queueFsm = new StateMachine({
    init: 'empty',
    transitions: [
        {name: 'queueHandler', from: ['waiting', 'empty'], to: 'dataHandling'},
        {name: 'handled', from: 'dataHandling', to: 'empty'},
        {name: 'wait', from: ['waiting', 'dataHandling'], to: 'waiting'},
    ],
    methods: {
        onQueueHandler: () => {
            logger.debug('Start Redis data handling');
            queuePush.emit('startQueueHandler');
        },
        onHandled: () => logger.debug('Redis data is handled'),
        onWait: () => logger.debug('Event not finished. Redis data is waiting for handling'),
    },
    plugins: [
        new StateMachineHistory(),
    ],
});

const connectToMatrix = () => (async () => {
    try {
        await chatApi.connect();
        queueFsm.queueHandler();

        return chatApi;
    } catch (err) {
        logger.error('No Matrix connection ', err);
        return null;
    }
})();


const checkQueueInterval = setInterval(() => {
    queuePush.emit('startQueueHandler');
}, CHECK_QUEUE_DELAY);
checkQueueInterval.unref();

const client = connectToMatrix();

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
        queueFsm.is('empty') ? queueFsm.queueHandler() : queueFsm.wait();
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

queuePush.on('startQueueHandler', async () => {
    if (chatApi.isConnected()) {
        logger.debug('queueFsm.state', queueFsm.state);
        await queueHandler(client);
    }
    queueFsm.is('waiting') ? queueFsm.queueHandler() : queueFsm.handled();
    queueFsm.clearHistory();
});

const onExit = err => {
    logger.warn('Jira Bot stopped ', err);
    clearInterval(checkQueueInterval);
    chatApi.disconnect();

    if (server.listening) {
        server.close();
    }

    process.exit(1);
};

process.on('exit', onExit);
process.on('SIGINT', onExit);
process.on('uncaughtException', onExit);
