const http = require('http');
const getLogger = require('./modules/log.js');
const logger = getLogger(module);
const EventEmitter = require('events');
const timelineHandler = require('./bot/timeline-handler');
const queueHandler = require('../src/queue');
const getApp = require('./express-app');
const StateMachine = require('javascript-state-machine');
const StateMachineHistory = require('javascript-state-machine/lib/history');

const CHECK_QUEUE_DELAY = 30 * 60 * 1000;

const queuePush = new EventEmitter();


const checkQueueInterval = setInterval(() => {
    queuePush.emit('startQueueHandler');
}, CHECK_QUEUE_DELAY);

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

const app = getApp(queueFsm);

const connectToChat = async chatApi => {
    try {
        await chatApi.connect();
    } catch (err) {
        logger.error('No Matrix connection ', err);
        return connectToChat(chatApi);
    }
};

const server = http.createServer(app);

module.exports = async (ChatApi, chatConfig, port) => {
    server.listen(port, () => {
        logger.info(`Server is listening on port ${port}`);
    });

    const chatApi = new ChatApi({config: chatConfig, timelineHandler, logger: getLogger('matrix-api')});

    queuePush.on('startQueueHandler', async () => {
        if (chatApi.isConnected()) {
            await queueHandler(chatApi);
        }
        queueFsm.is('waiting') ? queueFsm.queueHandler() : queueFsm.handled();
        queueFsm.clearHistory();
    });

    checkQueueInterval.unref();


    await connectToChat(chatApi);
    queueFsm.queueHandler();

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
};
