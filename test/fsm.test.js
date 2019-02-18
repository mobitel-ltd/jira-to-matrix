const delay = require('delay');
const Fsm = require('../src/fsm');
const {states} = require('../src/fsm/states');
const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe.only('Fsm test', () => {
    const chatApi = {
        connect: async () => {
            await delay(100);
        },
    };
    const handler = stub().resolves();

    afterEach(() => {
        handler.resetHistory();
    });

    it('Expect fsm state is "ready" after queue is handled', async () => {
        const fsm = new Fsm(chatApi, handler);
        await fsm.start();
        await fsm.handle();

        expect(fsm.state()).to.be.eq(states.ready);
    });

    it('Expect fsm state is "ready" after start connection and call handle during connection', async () => {
        const expectedData = [states.init, states.connected, states.ready];
        const fsm = new Fsm(chatApi, handler);
        fsm.start();
        await fsm.handle();
        await delay(150);

        expect(handler).to.be.calledOnce;
        expect(fsm.state()).to.be.eq(states.ready);
        expect(fsm.history()).to.be.deep.eq(expectedData);
    });

    it.skip('Expect fsm wait until handling is finished but new hook we get', async () => {
        const expectedData = [states.init, states.connected, states.ready];
        const longTimeHandler = stub().callsFake(() => delay(100)).resolves();
        const fsm = new Fsm(chatApi, longTimeHandler);
        await fsm.start();
        await delay(150);
        await fsm.handle();
        await fsm.handle();
        await delay(1000);

        expect(longTimeHandler).to.be.calledTwice;
        expect(fsm.state()).to.be.eq(states.ready);
        expect(fsm.history()).to.be.deep.eq(expectedData);
    });
});
