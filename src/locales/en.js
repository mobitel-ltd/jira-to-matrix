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
})

module.exports.dict = dict
