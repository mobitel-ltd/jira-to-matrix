const {shouldCreateRoom} = require('../src/bot/create-room').forTests;
const assert = require('assert');


describe('shouldCreateRoom', () => {
    const samples = [
        [{webhookEvent: 'jira:issue_created', issue: {}}, true],
        [{webhookEvent: 'jira:issue_updated', issue: {}}, false],
        [{webhookEvent: 'jira:issue_created'}, false],
        [{}, false],
        [undefined, false],
    ];
    it('Should create room on webhook or not', () => {
        samples.forEach(sample => {
            const result = shouldCreateRoom(sample[0]);
            assert.equal(result, sample[1]);
        });
    });
});
