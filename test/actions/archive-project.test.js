const chai = require('chai');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

const { getLastMessageTimestamp } = require('../../src/bot/actions/archive-project');
const rawEventsData = require('../fixtures/archiveRoom/raw-events');
const expected = require('../fixtures/archiveRoom/raw-events-data');

describe('Archive project', () => {
    it('Expect getLastMessageTimestamp return last message timestamp', () => {
        const res = getLastMessageTimestamp(rawEventsData);
        expect(res).to.eq(expected.maxTs);
    });
});
