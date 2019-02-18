const http = require('http');
const conf = require('./config');
const getMessengerApi = require('./messengers');
const getLogger = require('./modules/log');
const logger = getLogger(module);
const timelineHandler = require('./bot/timeline-handler');
const getFsm = require('./fsm');
const getApp = require('./express-app');
const queueHandler = require('../src/queue');

const MessengerApi = getMessengerApi(conf.messenger.name);
const messengerApi = new MessengerApi({config: conf.messenger, timelineHandler, logger: getLogger('matrix-api')});

const fsm = getFsm(messengerApi, queueHandler);

const app = getApp(fsm);
const server = http.createServer(app);
server.listen(conf.port, () => {
    logger.info(`Server is listening on port ${conf.port}`);
});

fsm.connectMatrix().then(async () => {
    logger.debug('fsm history', fsm.history);
    await fsm.handleQueue();
    logger.debug('fsm history', fsm.history);
});

const onExit = err => {
    logger.warn('Jira Bot stopped ', err);
    messengerApi.disconnect();

    process.exit(1);
};

process.on('exit', onExit);
process.on('SIGINT', onExit);
process.on('uncaughtException', onExit);

