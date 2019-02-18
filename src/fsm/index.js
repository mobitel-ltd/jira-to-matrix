const logger = require('../modules/log')(module);
const StateMachine = require('javascript-state-machine');
const StateMachineHistory = require('javascript-state-machine/lib/history');
const {states} = require('./states');

const getJiraFsm = parseHook => new StateMachine({
    init: states.init,
    transitions: [
        {name: 'hookResponsed', from: '*', to: states.hookResponsed},
        {name: 'handlingInProgress', from: '*', to: states.handlingInProgress},
        {name: 'handled', from: '*', to: states.init},
    ],
    methods: {
        onEnterState() {
            logger.debug('Now jira fsm state is "%s"', this.state);
        },
        // onPendingTransition(transition, from, to) {
        //     logger.error('FSM error', transition, from, to);
        // },
    },
});

const getMatrixFsm = (chatApi, handler) => {
    const fsm = new StateMachine({
        init: states.init,
        transitions: [
            {name: 'connect', from: states.init, to: states.startConnection},
            {name: 'finishConnection', from: states.startConnection, to: states.ready},
            {name: 'handleQueue', from: states.ready, to: states.startHandling},
            {name: 'finishHandle', from: states.startHandling, to: states.ready},
        ],
        methods: {
            async onConnect() {
                await chatApi.connect();
            },
            onFinishConnection() {
                logger.debug('Chat connected');
            },
            async onHandleQueue() {
                logger.debug('Start queue handling');
                await handler(chatApi);
            },
            onFinishHandle() {
                logger.debug('Finish queue handling');
            },
            onEnterState() {
                logger.debug('Now matrix fsm state is "%s"', this.state);
            },
            // onPendingTransition(transition, from, to) {
            //     logger.error('FSM error', transition, from, to);
            // },
        },
        plugins: [
            new StateMachineHistory({max: 10}),
        ],
    });

    return fsm;
};

module.exports = class {
    /**
     * @param {Object} chatApi instance of messenger Api, matrix or slack for example
     * @param {function} queueHandler redis queue handle function
     */
    constructor(chatApi, queueHandler) {
        this.matrixFsm = getMatrixFsm(chatApi, queueHandler);
        this.jiraFsm = getJiraFsm();
    }

    /**
     * Handling Jira hook
     */
    async handleHook() {
        this.jiraFsm.hookResponsed();
        await this.handle();
    }

    /**
     * Handling redis data
     */
    async handle() {
        if (this.matrixFsm.can('handleQueue')) {
            this.jiraFsm.handled();
            await this.matrixFsm.handleQueue();
            this.matrixFsm.finishHandle();

            this.jiraFsm.is('hookResponsed') && await this.handle();
        }
    }

    /**
     * Start service with matrix connection and first handling redis data
     */
    async start() {
        await this.matrixFsm.connect();
        this.matrixFsm.finishConnection();
        this.jiraFsm.handlingInProgress();
        await this.matrixFsm.handleQueue();
        this.matrixFsm.finishHandle();

        this.jiraFsm.is('hookResponsed') ? await this.handle() : this.jiraFsm.handled();
    }

    /**
     * @param  {String} fsmName='matrixFsm'
     * @returns {Array} fsm states history
     */
    history(fsmName = 'matrixFsm') {
        return this[fsmName].history;
    }

    /**
     * @param  {String} fsmName='matrixFsm'
     * @returns {String} fsm current state
     */
    state(fsmName = 'matrixFsm') {
        return this[fsmName].state;
    }
};
