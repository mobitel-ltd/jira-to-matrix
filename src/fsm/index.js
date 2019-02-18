const logger = require('../modules/log')(module);
const StateMachine = require('javascript-state-machine');
const StateMachineHistory = require('javascript-state-machine/lib/history');
const {states} = require('./states');

const getJiraFsm = parseHook => new StateMachine({
    init: states.init,
    transitions: [
        {name: 'hookResponsed', from: '*', to: states.hookResponsed},
        {name: 'handlingInProgress', from: '*', to: states.handlingInProgress},
        {name: 'handled', from: states.handlingInProgress, to: states.init},
    ],
    methods: {
        onHookResponsed: () => logger.debug('Jira hook ready to handle'),
        onHandlingInProgress: () => logger.debug('Data start handling'),
        onHandled: () => logger.debug('All data is handled!!!'),
        onPendingTransition(transition, from, to) {
            logger.error('FSM error', transition, from, to);
        },
    },
});

const getMatrixFsm = (chatApi, handler) => {
    const fsm = new StateMachine({
        init: states.init,
        transitions: [
            {name: 'connect', from: states.init, to: states.connected},
            {name: 'handleQueue', from: [states.waiting, states.connected], to: states.ready},
        ],
        methods: {

            async onConnect() {
                await chatApi.connect();
            },
            async onHandleQueue() {
                logger.debug('Start queue handling');
                // this.startQueueHandling;
                await handler(chatApi);
                logger.debug('Finish queue handling');
                // console.log('onHandleQueue', this.state);
            },
            onAfterTransition() {
                logger.debug('State "%s" is finished', this.state);
            },
            onPendingTransition(transition, from, to) {
                logger.error('FSM error', transition, from, to);
            },
        },
        plugins: [
            new StateMachineHistory({max: 10}),
        ],
    });

    return fsm;
};

module.exports = class {
    constructor(chatApi, queueHandler) {
        this.matrixFsm = getMatrixFsm(chatApi, queueHandler);
        this.jiraFsm = getJiraFsm();
    }

    async handle() {
        this.jiraFsm.hookResponsed();
        console.log('matrixFsm.can(handleQueu)', this.jiraFsm.state);
        if (this.matrixFsm.can('handleQueue')) {
            await this.matrixFsm.handleQueue();
            this.jiraFsm.is('hookResponsed') ? await this.handle() : this.jiraFsm.handled();
        }
    }

    async start() {
        await this.matrixFsm.connect();
        this.jiraFsm.handlingInProgress();
        await this.matrixFsm.handleQueue();
        console.log('start handle', this.jiraFsm.state);
        this.jiraFsm.is('hookResponsed') ? await handle() : this.jiraFsm.handled();
    }
    history() {
        return this.matrixFsm.history;
    }
    state() {
        return this.matrixFsm.state;
    }
};
