const { isCreateRoom } = require('../../src/jira-hook-parser/bot-handler');
const assert = require('assert');
const commentHook = require('../fixtures/webhooks/comment/created.json');

describe('create-room', () => {
    it('Should create room on webhook or not', () => {
        const samples = [
            [{ webhookEvent: 'jira:issue_created', issue: { key: 'smth' } }, true],
            [{ webhookEvent: 'jira:issue_updated', issue: {} }, undefined],
            [{ webhookEvent: 'jira:issue_created' }, undefined],
            [{}, undefined],
            [undefined, undefined],
        ];
        samples.forEach((sample, index) => {
            const result = isCreateRoom(sample[0]);
            assert.equal(result, sample[1]);
        });
    });

    it('Create comment should be ignored', () => {
        const res = isCreateRoom(commentHook);
        assert.equal(res, undefined);
    });
});
