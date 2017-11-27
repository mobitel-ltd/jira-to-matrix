const {isCommentEvent} = require('../src/bot/post-comment/post-comment').forTests;
const assert = require('assert');

test('Check if hook is a comment event', () => {
    const samples = [
        [{webhookEvent: 'comment_created'}, true],
        [{webhookEvent: 'comment_updated', issue_event_type_name: ''}, true],
        [{webhookEvent: 'jira:issue_updated', issue_event_type_name: 'lalala'}, true],
        [{webhookEvent: 'jira:issue_updated', issue_event_type_name: 'issue_commented'}, false],
        [{webhookEvent: 'jira:issue_updated', issue_event_type_name: 'issue_comment_edited'}, false],
        [{}, false],
        [{webhookEvent: 'lalala', issue_event_type_name: ''}, false],
        [{webhookEvent: '', issue_event_type_name: ''}, false],
    ];
    samples.forEach(sample => {
        const result = isCommentEvent(sample[0]);
        assert.equal(result, sample[1]);
    });
});
