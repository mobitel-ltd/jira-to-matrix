import * as assert from 'assert';
import commentCreatedHook from '../../fixtures/webhooks/comment/created.json';
import commentDeletedHook from '../../fixtures/webhooks/comment/deleted.json';
import commentUpdatedHook from '../../fixtures/webhooks/comment/updated.json';
import issueCommentedHook from '../../fixtures/webhooks/issue/updated/commented.json';
import issueCommentedChangedHook from '../../fixtures/webhooks/issue/updated/commented-changed.json';
import issueUpdatedGenericHook from '../../fixtures/webhooks/issue/updated/generic.json';
import issueCreatedHook from '../../fixtures/webhooks/issue/created.json';
import issueLinkCreatedHook from '../../fixtures/webhooks/issuelink/created.json';
import issueLinkDeletedHook from '../../fixtures/webhooks/issuelink/deleted.json';
import { taskTracker } from '../../test-utils';

describe('bot func with jira config data', () => {
    it('Expect commentCreatedHook have only postComment func', () => {
        const result = taskTracker.parser.getBotActions(commentCreatedHook);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('Expect commentUpdatedHook have only postComment func', () => {
        const result = taskTracker.parser.getBotActions(commentUpdatedHook);
        const expected = ['postComment'];
        assert.deepEqual(result, expected);
    });

    it('Expect commentDeletedHook have no func to handle', () => {
        const result = taskTracker.parser.getBotActions(commentDeletedHook);
        const expected = [];
        assert.deepEqual(result, expected);
    });

    it('Expect issueCommentedHook return correct funcs list', () => {
        const result = taskTracker.parser.getBotActions(issueCommentedHook);
        const expected = ['inviteNewMembers', 'postEpicUpdates'];
        assert.deepEqual(result, expected);
    });

    it('Expect issueUpdatedGenericHook return correct funcs list', () => {
        const funcsForBot = taskTracker.parser.getBotActions(issueUpdatedGenericHook);
        assert.deepEqual(funcsForBot, [
            'postIssueUpdates',
            'inviteNewMembers',
            'postEpicUpdates',
            'postProjectUpdates',
            'postNewLinks',
            'postLinkedChanges',
        ]);
    });

    it('Expect issueLinkCreatedHook return correct funcs list', () => {
        const result = taskTracker.parser.getBotActions(issueLinkCreatedHook);
        const expected = ['postNewLinks'];
        assert.deepEqual(result, expected);
    });

    it('Expect issueLinkDeletedHook return correct funcs list', () => {
        const result = taskTracker.parser.getBotActions(issueLinkDeletedHook);
        const expected = ['postLinksDeleted'];
        assert.deepEqual(result, expected);
    });

    it('Expect issueCreatedHook return correct funcs list', () => {
        const result = taskTracker.parser.getBotActions(issueCreatedHook);
        const expected = ['postEpicUpdates'];
        assert.deepEqual(result, expected);
    });

    it('Expect issueCommentedChangedHook return correct funcs list', () => {
        const result = taskTracker.parser.getBotActions(issueCommentedChangedHook);
        const expected = ['postIssueUpdates', 'inviteNewMembers', 'postEpicUpdates'];
        assert.deepEqual(result, expected);
    });
});
