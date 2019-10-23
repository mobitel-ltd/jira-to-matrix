const assert = require('assert');
const { getBotActions } = require('../../src/jira-hook-parser/bot-handler');
const commentCreatedHook = require('../fixtures/webhooks/comment/created.json');
const commentDeletedHook = require('../fixtures/webhooks/comment/deleted.json');
const commentUpdatedHook = require('../fixtures/webhooks/comment/updated.json');
const issueCommentedHook = require('../fixtures/webhooks/issue/updated/commented.json');
const issueCommentedChangedHook = require('../fixtures/webhooks/issue/updated/commented-changed.json');
const issueUpdatedGenericHook = require('../fixtures/webhooks/issue/updated/generic.json');
const issueCreatedHook = require('../fixtures/webhooks/issue/created.json');
const issueLinkCreatedHook = require('../fixtures/webhooks/issuelink/created.json');
const issueLinkDeletedHook = require('../fixtures/webhooks/issuelink/deleted.json');

describe('bot func', () => {
    it('Expect commentCreatedHook have only postComment func', () => {
        const result = getBotActions(commentCreatedHook);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('Expect commentUpdatedHook have only postComment func', () => {
        const result = getBotActions(commentUpdatedHook);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('Expect commentDeletedHook have no func to handle', () => {
        const result = getBotActions(commentDeletedHook);
        const expected = [];
        assert.deepEqual(result, expected);
    });

    it('Expect issueCommentedHook returns correct funcs list', () => {
        const result = getBotActions(issueCommentedHook);
        const expected = ['inviteNewMembers', 'postEpicUpdates'];
        assert.deepEqual(result, expected);
    });

    it('Expect issueUpdatedGenericHook returns correct funcs list', () => {
        const funcsForBot = getBotActions(issueUpdatedGenericHook);
        assert.deepEqual(funcsForBot, [
            'postIssueUpdates',
            'inviteNewMembers',
            'postEpicUpdates',
            'postProjectUpdates',
            'postNewLinks',
            'postLinkedChanges',
        ]);
    });

    it('Expect issueLinkCreatedHook returns correct funcs list', () => {
        const result = getBotActions(issueLinkCreatedHook);
        const expected = ['postNewLinks'];
        assert.deepEqual(result, expected);
    });

    it('Expect issueLinkDeletedHook returns correct funcs list', () => {
        const result = getBotActions(issueLinkDeletedHook);
        const expected = ['postLinksDeleted'];
        assert.deepEqual(result, expected);
    });

    it('Expect issueCreatedHook returns correct funcs list', () => {
        const result = getBotActions(issueCreatedHook);
        const expected = ['postEpicUpdates'];
        assert.deepEqual(result, expected);
    });

    it('Expect issueCommentedChangedHook returns correct funcs list', () => {
        const result = getBotActions(issueCommentedChangedHook);
        const expected = ['postIssueUpdates', 'inviteNewMembers', 'postEpicUpdates'];
        assert.deepEqual(result, expected);
    });
});
