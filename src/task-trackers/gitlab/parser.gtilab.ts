import {
    Parser,
    Config,
    CreateRoomData,
    PostCommentData,
    InviteNewMembersData,
    PostIssueUpdatesData,
    UploadData,
    IssueStateEnum,
} from '../../types';
import { GitlabSelectors } from './types';

export class GitlabParser implements Parser {
    issueMovedType = 'issueMovedType';

    constructor(private features: Config['features'], private selectors: GitlabSelectors) {}

    isPostIssueUpdates(body) {
        return Boolean(
            (this.features.postIssueUpdates &&
                this.selectors.getIssueChanges(body) &&
                this.selectors.isCorrectWebhook(body, 'update')) ||
                this.selectors.isCorrectWebhook(body, 'close') ||
                this.selectors.isCorrectWebhook(body, 'reopen'),
        );
    }

    getPostIssueUpdatesData(body): PostIssueUpdatesData {
        const author = this.selectors.getDisplayName(body)!;
        const changes = this.selectors.getIssueChanges(body)!;
        const newTitleData = changes.find(data => data.field === 'title');
        const oldKey = this.selectors.getIssueKey(body);
        let newRoomName: string | undefined;
        if (newTitleData) {
            newRoomName = this.selectors.composeRoomName(oldKey, {
                summary: newTitleData.newValue,
            });
        }
        if (this.selectors.isCorrectWebhook(body, 'close')) {
            newRoomName = this.selectors.composeRoomName(oldKey, {
                summary: this.selectors.getSummary(body)!,
                state: IssueStateEnum.close,
            });
        }
        if (this.selectors.isCorrectWebhook(body, 'reopen')) {
            newRoomName = this.selectors.composeRoomName(oldKey, {
                summary: this.selectors.getSummary(body)!,
                state: IssueStateEnum.open,
            });
        }
        const isNewStatus = Boolean(changes.find(data => data.field === 'labels' || data.field === 'status'));

        const projectKey = this.selectors.getProjectKey(body)!;

        return { oldKey, changes, author, projectKey, newRoomName, isNewStatus };
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
        return Boolean(
            this.features.postComments && this.selectors.isCommentEvent(body) && !this.selectors.isUploadBody(body),
        );
    }

    getInviteNewMembersData(body): InviteNewMembersData {
        const key = this.selectors.getIssueKey(body);
        const descriptionFields = this.selectors.getDescriptionFields(body);
        const projectKey = this.selectors.getProjectKey(body);

        return { key, typeName: descriptionFields?.typeName, projectKey };
    }

    getUploadData(body): UploadData {
        return {
            uploadInfo: this.selectors.getUploadInfo(body)!,
            issueKey: this.selectors.getIssueKey(body),
            uploadUrl: this.selectors.getUploadUrl(body)!,
        };
    }

    isMemberInvite(body) {
        return (
            this.features.inviteNewMembers &&
            (this.selectors.isCorrectWebhook(body, 'update') || this.selectors.isCorrectWebhook(body, 'reopen'))
        );
    }

    isUpload(body) {
        return this.features.postComments && this.selectors.isCommentEvent(body) && this.selectors.isUploadBody(body);
    }

    actionFuncs = {
        postComment: this.isPostComment,
        inviteNewMembers: this.isMemberInvite,
        postIssueUpdates: this.isPostIssueUpdates,
        upload: this.isUpload,
    };

    getBotActions(body) {
        return Object.keys(this.actionFuncs).filter(key => this.actionFuncs[key].bind(this)(body));
    }
}
