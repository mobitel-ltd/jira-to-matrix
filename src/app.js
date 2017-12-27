const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const EventEmitter = require('events');
const StateMachine = require('javascript-state-machine');

const conf = require('./config');
const Matrix = require('./matrix');
const logger = require('./modules/log.js')(module);
const getParsedAndSaveToRedis = require('../src/queue/get-parsed-and-save-to-redis.js');
const newQueueHandler = require('../src/queue');

const queuePush = new EventEmitter();

const matrixFsm = new StateMachine({
    init: 'empty',
    transitions: [
        {name: 'connectToMatrix', from: 'empty', to: 'matrixConnection'},
        {name: 'matrixConnected', from: 'matrixConnection', to: 'matrixConnected'},
        {name: 'fakeConnect', from: 'matrixConnection', to: 'empty'},

    ],
    methods: {
        onConnectToMatrix: () => (async () => {
            try {
                const connection = await Matrix.connect();
                queuePush.emit('startQueueHandler');

                matrixFsm.onMatrixConnected();
                return connection;
            } catch (err) {
                matrixFsm.onFakeConnect();
                return null;
            }
        })(),
        onFakeConnect: () => logger.error('No Matrix connection '),
        onMatrixConnected: () => logger.info('Mattrix connected'),

    },
});

const queueFsm = new StateMachine({
    init: 'empty',
    transitions: [
        {name: 'queueHandler', from: 'empty', to: 'dataHandling'},
        {name: 'isHandled', from: ['waiting', 'dataHandling'], to: 'empty'},
        {name: 'isWaiting', from: 'dataHandling', to: 'waiting'},
    ],
    methods: {
        onQueueHandler: state => {
            logger.debug('state', state);
            if (queueFsm.is('empty')) {
                fsm.queueHandler
                queuePush.emit('startQueueHandler');
            }
        },
        onIsHandled: () => logger.info('Redis data is handling'),
        onIsWaiting: () => logger.info('Redis data is is waiting for handling'),
    },


});

const CHECK_QUEUE_DELAY = 30 * 60 * 1000;

const checkQueueInterval = setInterval(() => {
    queuePush.emit('startQueueHandler');
}, CHECK_QUEUE_DELAY);
checkQueueInterval.unref();

const client = matrixFsm.onConnectToMatrix();

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
        logger.debug('queueFsm.state', queueFsm.state);
        queueFsm.is('empty') ? queueFsm.onQueueHandler() : queueFsm.onIsWaiting();
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
    logger.info('queuePush start');
    if (client) {
        logger.debug('queueFsm.state', queueFsm.state);
        await newQueueHandler(client);
    }
    if (queueFsm.is('waiting')) {
        queueFsm.onIsHandled();
        queuePush.emit('startQueueHandler');
    }
});

const onExit = err => {
    logger.warn('Jira Bot stoped ', err);
    clearInterval(checkQueueInterval);
    Matrix.disconnect();

    if (server.listening) {
        server.close();
    }

    process.exit(1);
};

process.on('exit', onExit);
process.on('SIGINT', onExit);
process.on('uncaughtException', onExit);
