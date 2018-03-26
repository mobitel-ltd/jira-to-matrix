const {getBotFunc} = require('../../src/queue/bot-handler');
const assert = require('assert');
const firstBody = require('../fixtures/comment-create-1.json');
const secondBody = require('../fixtures/comment-create-2.json');
const {
    postEpicUpdates,
    postComment,
    createRoom,
    inviteNewMembers,
    postNewLinks,
    postLinkedChanges,
    postIssueUpdates,
    postProjectUpdates,
} = require('../../src/bot');
const bot = require('../../src/bot');
const {
    getPostEpicUpdatesData,
    getPostCommentData,
    getCreateRoomData,
    getInviteNewMembersData,
    getPostNewLinksData,
    getPostLinkedChangesData,
    getPostIssueUpdatesData,
    getPostProjectUpdatesData,
} = require('../../src/queue/parse-body.js');

describe('bot func', function() {
    this.timeout(15000);

    it('test correct JSON', () => {
        const result = typeof firstBody;
        assert.equal(result, 'object');
    });

    it('test correct funcs ', () => {
        const result = getBotFunc(firstBody);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('test correct funcs seconBody', () => {
        const result = getBotFunc(secondBody);
        const expected = [
            'inviteNewMembers',
            'postEpicUpdates',
        ];
        assert.deepEqual(result, expected);
    });

    it('async arr expect', () => {
        const funcsForBot = getBotFunc(firstBody);
        const result = funcsForBot.map(func => bot[func]);
        assert.ok(Array.isArray(result));
    });

});
