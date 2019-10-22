const app = require('../src/jira-app');
const delay = require('delay');
const Fsm = require('../src/fsm');
const { states } = require('../src/fsm/states');
const chai = require('chai');
const { stub } = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

describe('Fsm test', () => {
    const port = 3000;
    const expectedData = [
        states.init,
        states.startConnection,
        states.ready,
        states.startHandling,
        states.ready,
        states.startHandling,
        states.ready,
    ];
    let fsm;
    const chatApi = {
        connect: async () => {
            await delay(1000);
        },
        disconnect: stub(),
        config: { user: 'fakeName' },
    };
    const handler = stub().resolves();

    afterEach(() => {
        handler.resetHistory();
        fsm.stop();
    });

    it('Expect fsm state is "ready" after queue is handled', async () => {
        fsm = new Fsm([chatApi], handler, app, port);
        await fsm.start();
        await fsm._handle();

        expect(fsm.state()).to.be.eq(states.ready);
    });

    it('Expect fsm state is "ready" after start connection and call handle during connection', async () => {
        fsm = new Fsm([chatApi], handler, app, port);
        await fsm.start();
        await fsm.handleHook();
        await delay(150);

        expect(handler).to.be.calledTwice;
        expect(fsm.state()).to.be.eq(states.ready);
        expect(fsm.history()).to.be.deep.eq(expectedData);
    });

    it('Expect fsm wait until handling is finished but new hook we get', async () => {
        const longTimeHandler = stub()
            .callsFake(() => delay(100))
            .resolves();
        fsm = new Fsm([chatApi], longTimeHandler, app, port);
        await fsm.start();
        await delay(50);
        await fsm.handleHook();

        expect(longTimeHandler).to.be.calledTwice;
        expect(fsm.state()).to.be.eq(states.ready);
        expect(fsm.history()).to.be.deep.eq(expectedData);
    });
});
