import {
    Parser,
    Selectors,
    Config,
    CreateRoomData,
    PostCommentData,
    InviteNewMembersData,
    PostIssueUpdatesData,
} from '../../types';

export class GitlabParser implements Parser {
    issueMovedType = 'issueMovedType';

    constructor(private features: Config['features'], private selectors: Selectors) {}

    isPostIssueUpdates(body) {
        return Boolean(
            this.features.postIssueUpdates &&
                this.selectors.isCorrectWebhook(body, 'update') &&
                this.selectors.getIssueChanges(body),
        );
    }

    getPostIssueUpdatesData(body): PostIssueUpdatesData {
        const author = this.selectors.getDisplayName(body)!;
        const changes = this.selectors.getIssueChanges(body)!;
        const newTitleData = changes.find(data => data.field === 'title');
        const oldKey = this.selectors.getIssueKey(body);
        const newRoomName = newTitleData && this.selectors.composeRoomName(oldKey, newTitleData.newValue);

        const projectKey = this.selectors.getProjectKey(body)!;

        return { oldKey, changes, author, projectKey, newRoomName };
    }

    isCreateRoom(body) {
        return Boolean(
            this.features.createRoom && this.selectors.getKey(body),
            // TODO not found webhook for issue moved to another project
            // && this.selectors.getTypeEvent(body) !== this.issueMovedType,
        );
    }

    getCreateRoomData(body): CreateRoomData {
        const projectKey = this.selectors.getProjectKey(body);
        const summary = this.selectors.getSummary(body);
        const key = this.selectors.getIssueKey(body);
        const descriptionFields = this.selectors.getDescriptionFields(body);

        const parsedIssue = { key, summary, projectKey, descriptionFields };

        return { issue: parsedIssue, projectKey };
    }

    getPostCommentData(body): PostCommentData {
        const headerText = this.selectors.getHeaderText(body)!;
        const author = this.selectors.getDisplayName(body)!;
        const issueId = this.selectors.getIssueKey(body);
        const comment = this.selectors.getCommentBody(body);

        return { issueId, headerText, comment, author };
    }

    isPostComment(body) {
        return Boolean(this.features.postComments && this.selectors.isCommentEvent(body));
    }

    getInviteNewMembersData(body): InviteNewMembersData {
        const key = this.selectors.getIssueKey(body);
        const descriptionFields = this.selectors.getDescriptionFields(body);
        const projectKey = this.selectors.getProjectKey(body);

        return { key, typeName: descriptionFields?.typeName, projectKey };
    }

    isMemberInvite(body) {
        return this.features.inviteNewMembers && this.selectors.isCorrectWebhook(body, 'update');
    }

    actionFuncs = {
        postComment: this.isPostComment,
        inviteNewMembers: this.isMemberInvite,
        postIssueUpdates: this.isPostIssueUpdates,
    };

    getBotActions(body) {
        return Object.keys(this.actionFuncs).filter(key => this.actionFuncs[key].bind(this)(body));
    }
}