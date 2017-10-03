// @flow
const dict = Object.freeze({
    comment_created: 'commented',
    comment_updated: 'changed comment',
    issue_updated: 'changed issue',
    issueHasChanged: 'Task was changed',
    statusHasChanged: '%{issue.key} "%{issue.fields.summary}" now has status "%{status}"',
    statusHasChangedMessage: '%{user.name} changed a linked issue status [%{issue.key} "%{issue.fields.summary}"](%{issue.ref}) to **%{status}**',
    newIssueInEpic: 'New issue in epic',
    issueAddedToEpic: 'An issue [%{issue.key} %{issue.fields.summary}](%{issue.ref}) was added to the epic',
    newLink: 'New link',
    newLinkMessage: 'A new link. This issue **%{relation}** [%{key} "%{summary}"](%{ref})',
    miss: 'missing',
    epicAddedToProject: 'An epic [%{issue.key} %{issue.fields.summary}](%{issue.ref}) was added to the project',
    newEpicInProject: 'New epic in project',
    statusEpicChanged: 'Epic was changed',
    statusEpicChangedMessage: '%{user.name} changed a linked epic status [%{issue.key} "%{issue.fields.summary}"](%{issue.ref}) to **%{status}**',
    errorMatrixCommands: 'Something went wrong! Your request failed, please try again.',
    errorMatrixAssign: 'FATAL ERROR! User "%{assignee}" don\'t exist.',
    successMatrixAssign: 'User %{assignee} appointed assignee',
    errorMatrixComment: 'Something went wrong! Comment not published',
    successMatrixComment: 'Comment published',
});

module.exports.dict = dict;
