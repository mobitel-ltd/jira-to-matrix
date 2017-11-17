const {shouldCreateRoom} = require('../src/bot/create-room').forTests;
const assert = require('assert');
const logger = require('debug')('test room create');

describe('create-room', () => {
    it('Should create room on webhook or not', () => {
        const samples = [
            [{webhookEvent: 'jira:issue_created', issue: {key: 'smth'}}, true],
            [{webhookEvent: 'jira:issue_updated', issue: {}}, false],
            [{webhookEvent: 'jira:issue_created'}, false],
            [{}, false],
            [undefined, false],
        ];
        samples.forEach((sample, index) => {
            const result = shouldCreateRoom(sample[0]);
            logger(`sample ${sample}, ${index}`);
            assert.equal(result, sample[1]);
        });
    });
});
