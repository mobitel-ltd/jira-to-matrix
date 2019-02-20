const http = require('http');
const logger = require('../modules/log')(module);
const StateMachine = require('javascript-state-machine');
const StateMachineHistory = require('javascript-state-machine/lib/history');
const {states} = require('./states');

const getJiraFsm = (app, port) => new StateMachine({
    init: states.init,
    transitions: [
        {name: 'start', from: states.init, to: states.ready},
        {name: 'hookResponsed', from: '*', to: states.hookResponsed},
        {name: 'handlingInProgress', from: [states.hookResponsed, states.ready], to: states.startHandling},
        {name: 'finishHandle', from: '*', to: states.ready},
        {name: 'stop', from: '*', to: states.init},
    ],
    data: {
        server: null,
    },
    methods: {
        onStart() {
            this.server = http.createServer(app);
            this.server.listen(port, () => {
                logger.info(`Jira hooks are listening on port ${port}`);
            });
        },
        onEnterState() {
            logger.debug('Now jira fsm state is "%s"', this.state);
        },
        onStop() {
            logger.info('Jira server close');
            return this.is('init') || this.server.close();
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
            {name: 'stop', from: '*', to: states.init},
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
            onStop() {
                logger.info('Matrix disconnected');
                return this.is('init') || chatApi.disconnect();
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
     * @param {function} app jira express REST app
     * @param {integer} port jira server port
     */
    constructor(chatApi, queueHandler, app, port) {
        this.matrixFsm = getMatrixFsm(chatApi, queueHandler);
        this.jiraFsm = getJiraFsm(app(this.handleHook.bind(this)), port);
    }

    /**
     * Handling Jira hook
     */
    async handleHook() {
        this.jiraFsm.hookResponsed();
        await this._handle();
    }

    /**
     * Handling redis data
     */
    async _handle() {
        if (this.matrixFsm.can('handleQueue')) {
            this.jiraFsm.handlingInProgress();
            await this.matrixFsm.handleQueue();
            this.matrixFsm.finishHandle();

            this.jiraFsm.is('hookResponsed') && await this._handle();
        }
    }

    /**
     * Start service with matrix connection and first handling redis data
     */
    async start() {
        this.jiraFsm.start();
        await this.matrixFsm.connect();
        this.matrixFsm.finishConnection();
        this.jiraFsm.handlingInProgress();
        await this.matrixFsm.handleQueue();
        this.matrixFsm.finishHandle();

        this.jiraFsm.is('hookResponsed') ? await this._handle() : this.jiraFsm.finishHandle();
    }

    /**
     * Test only
     * @param  {String} fsmName='matrixFsm'
     * @returns {Array} fsm states history
     */
    history(fsmName = 'matrixFsm') {
        return this[fsmName].history;
    }

    /**
     * Test only
     * @param  {String} fsmName='matrixFsm'
     * @returns {String} fsm current state
     */
    state(fsmName = 'matrixFsm') {
        return this[fsmName].state;
    }

    /**
     * Stop all
     */
    stop() {
        this.jiraFsm.stop();
        this.matrixFsm.stop();
    }
};
