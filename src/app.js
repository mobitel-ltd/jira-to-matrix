const conf = require('./config');
const MessengerApi = require('./messengers')(conf.messenger.name);
const getLogger = require('./modules/log');
const logger = getLogger(module);
const timelineHandler = require('./bot/timeline-handler');
const FSM = require('./fsm');
const app = require('./jira-app');
const queueHandler = require('../src/queue');

const messengerApi = new MessengerApi({config: conf.messenger, timelineHandler, logger: getLogger('matrix-api')});

const fsm = new FSM(messengerApi, queueHandler, app, conf.port);

fsm.start();

const onExit = err => {
    logger.warn('Jira Bot stopped ', err);
    fsm.stop();

    process.exit(1);
};

process.on('exit', onExit);
process.on('SIGINT', onExit);
process.on('uncaughtException', onExit);
