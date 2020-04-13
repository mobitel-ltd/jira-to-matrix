const conf = require('./config');
const getChatApi = require('./messengers');
const getLogger = require('./modules/log');
const logger = getLogger(module);
const commandsHandler = require('./bot/commands');
const FSM = require('./fsm');
const app = require('./jira-app');
const queueHandler = require('../src/queue');
const matrixSdk = require('matrix-js-sdk');
const { logger: mxLogger } = require('matrix-js-sdk/lib/logger');

const ChatApi = getChatApi(conf.messenger.name);
let sdk;
if (conf.messenger.name === 'matrix') {
    const matrixSdkLogger = getLogger('matrix-SDK');

    mxLogger.info = (...msg) => matrixSdkLogger.info(JSON.stringify(msg.join('\n')));
    mxLogger.log = (...msg) => matrixSdkLogger.debug(JSON.stringify(msg.join('\n')));
    mxLogger.warn = (...msg) => matrixSdkLogger.warn(JSON.stringify(msg.join('\n')));
    mxLogger.error = (...msg) => matrixSdkLogger.error(JSON.stringify(msg.join('\n')));
    mxLogger.trace = (...msg) => matrixSdkLogger.trace(JSON.stringify(msg.join('\n')));

    sdk = matrixSdk;
}

const apiCollection = conf.messenger.bots.map(
    item =>
        new ChatApi({
            config: { ...conf.messenger, ...item, baseConfig: conf },
            commandsHandler,
            logger: getLogger('messenger-api'),
            sdk,
        }),
);

const fsm = new FSM(apiCollection, queueHandler, app, conf.port);

fsm.start();

const onExit = err => {
    logger.warn('Jira Bot stopped ', err);
    fsm.stop();

    process.exit(1);
};

process.on('exit', onExit);
process.on('SIGINT', onExit);
process.on('uncaughtException', onExit);
