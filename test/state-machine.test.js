const assert = require('assert');
const logger = require('../src/modules/log.js')(module);
const StateMachine = require('javascript-state-machine');
const EventEmitter = require('events');

logger.debug('start');
const queuePush = new EventEmitter();

const promiseFunc = (value, timeout) => new Promise((res, rej) => {
    setTimeout(() => res(value), timeout);
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
                queueFsm.queueHandler();
                queuePush.emit('startQueueHandler');
            }
        },
        onIsHandled: () => logger.info('Redis data is handling'),
        onIsWaiting: () => logger.info('Redis data is is waiting for handling'),
    },
});



queuePush.on('startQueueHandler', async () => {
    logger.info('queuePush start');
    logger.debug('queueFsm.state', queueFsm.state);
    logger.debug('async function', promiseFunc);
    const result = await promiseFunc('success', 5000);
    logger.debug('result', result);
    // assert.equal(result, 'success');

    if (queueFsm.is('waiting')) {
        queueFsm.onIsHandled();
        queuePush.emit('startQueueHandler');
    }
});

describe('state machine test', function() {
    this.timeout(15000);

    const CHECK_QUEUE_DELAY = 3000;

    it('delay', async () => {
        const result = await promiseFunc('promise result', 10000);
        logger.debug('promise result', result);

        setInterval(() => {
            queuePush.emit('startQueueHandler');
        }, CHECK_QUEUE_DELAY);
    });
});
