const http = require('http');
const getLogger = require('./modules/log.js');
const logger = getLogger(module);
const StateMachine = require('javascript-state-machine');
const StateMachineHistory = require('javascript-state-machine/lib/history');
const getApp = require('./express-app');
const timelineHandler = require('./bot/timeline-handler');
const queueHandler = require('../src/queue');

const states = {
    // matrix and jira are not connected, start of app
    init: 'init',
    // only jira connected
    jiraConnected: 'jiraConnected',
    // all is connected
    allConnected: 'allConnected',
    // got hook from jira
    hookResponsed: 'hookResponsed',
    // queue handling
    queueHandling: 'queueHandling',
    // all data is handled and app is waiting for hooks
    ready: 'ready',
    // queue is ready to be handled and wait for connection to matrix or finish current queue handling
    waiting: 'waiting',
};

const notReadyStates = [states.jiraConnected, states.queueHandling, states.waiting];
const readyStates = [states.allConnected, states.waiting, states.ready];


module.exports = (ChatApi, chatConfig, port) => {
    const chatApi = new ChatApi({config: chatConfig, timelineHandler, logger: getLogger('matrix-api')});

    const fsm = new StateMachine({
        init: 'init',
        transitions: [
            {name: 'connectJira', from: states.init, to: states.jiraConnected},
            {name: 'connectMatrix', from: states.jiraConnected, to: states.allConnected},
            {name: 'hookHandle', from: notReadyStates, to: states.waiting},
            {name: 'hookHandle', from: readyStates, to: states.queueHandling},
            {name: 'handleQueue', from: readyStates, to: states.queueHandling},
            {name: 'getReady', from: states.queueHandling, to: states.waiting},
        ],
        methods: {
            onConnectJira: () => {
                const app = getApp(fsm);
                const server = http.createServer(app);
                server.listen(port, () => {
                    logger.info(`Server is listening on port ${port}`);
                });
            },
            onConnectMatrix: async () => {
                await chatApi.connect();
            },
            onHookHandle: () =>
                (readyStates.includes(this.state) && queueHandler(chatApi)),
        },
        plugins: [
            new StateMachineHistory(),
        ],
    });

    const onExit = err => {
        logger.warn('Jira Bot stopped ', err);
        chatApi.disconnect();

        process.exit(1);
    };

    process.on('exit', onExit);
    process.on('SIGINT', onExit);
    process.on('uncaughtException', onExit);
};
