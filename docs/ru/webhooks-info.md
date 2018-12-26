# Jira webhook structure

## Webhook types

### Issue

1. jira:issue_created
    * [Webhook example](../../test/fixtures/webhooks/issue/created.json)
    * [Handler](../../src/bot/create-room.js)
    * [Test](../../test/bot/create-room.test.js)
2. jira:issue_updated
<!-- 3. jira:issue_deleted -->

### Comment

1. comment_created
    * [Webhook example](../../test/fixtures/webhooks/comment/created.json)
    * [Handler](../../src/bot/post-comment.js)
    * [Test](../../test/bot/post-comment.test.js)
2. comment_updated
    * [Webhook example](../../test/fixtures/webhooks/comment/updated.json)
    * [Handler](../../src/bot/post-comment.js)
    * [Test](../../test/bot/post-comment.test.js)

### Link

1. issuelink_created
    * [Webhook example](../../test/fixtures/webhooks/issuelink/created.json)
    * [Handler](../../src/bot/post-new-links.js)
    * [Test](../../test/bot/post-new-links.test.js)
2. issuelink_deleted
    * [Webhook example](../../test/fixtures/issuelink-deleted.json)
    * [Handler](../../src/bot/post-link-deleted.js)
    * [Test](../../test/bot/post-link-deleted.test.js)

### Project

1. project_created
2. project_updated
<!-- 3. project_deleted -->
