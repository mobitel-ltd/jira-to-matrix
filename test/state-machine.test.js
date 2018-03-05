const assert = require('assert');
const {debug} = require('../src/modules/log.js')(module);
const StateMachine = require('javascript-state-machine');
const EventEmitter = require('events');
const StateMachineHistory = require('javascript-state-machine/lib/history');

const queuePush = new EventEmitter();

let store = {};

const queueFsm = new StateMachine({
    init: 'empty',
    transitions: [
        {name: 'queueHandler', from: ['waiting', 'empty'], to: 'dataHandling'},
        {name: 'handled', from: 'dataHandling', to: 'empty'},
        {name: 'wait', from: ['waiting', 'dataHandling'], to: 'waiting'},
    ],
    methods: {
        onQueueHandler: () => {
            debug('Start Redis data handling');
            queuePush.emit('startQueueHandler');
        },
        onHandled: () => debug('Redis data is handling'),
        onWait: () => debug('Event not finished. Redis data is waiting for handling'),
    },
    plugins: [
        new StateMachineHistory()
    ]
});

const promiseFunc = (value, timeout) => new Promise((res, rej) => {
    setTimeout(() => {
        debug('value', value);
        const filteredKeys = Object.keys(store).filter(key => !Object.keys(value).includes(key));
        store = filteredKeys.reduce((acc, key) => ({...acc, [key]: key}), {});
        if (filteredKeys.length === 0) {
            queueFsm.handled();
        }
        debug('filtered store', store);
        res(value);
    }, timeout);
});

queuePush.on('startQueueHandler', async () => {
    debug('queuePush start');
    debug('startQueueHandler state', queueFsm.state);

    const result = await promiseFunc(store, 5000);
    debug('result', result);

    debug('current state is', queueFsm.state);
    queueFsm.is('waiting') ? queueFsm.queueHandler() : debug('history', queueFsm.history);
});

describe('state machine test', function() {
    this.timeout(15000);

    const CHECK_QUEUE_DELAY = 2000;
    const CLEAR_DELAY = 10000;
    const intervalFunc = () => {
        debug('intervalFunc state', queueFsm.state);
        const date = (new Date()).getTime().toString();
        store = {...store, [date]: date}
        queueFsm.is('empty') ? queueFsm.queueHandler() : queueFsm.wait();
    };
    it('delay', async () => {
        const interval = setInterval(intervalFunc, CHECK_QUEUE_DELAY);
        interval.ref();
        setTimeout(() => {
            debug('delete interval');
            clearInterval(interval);
        }, CLEAR_DELAY);
    });
});
