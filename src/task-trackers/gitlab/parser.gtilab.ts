import { Parser, Selectors, Config, CreateRoomData, PostCommentData } from '../../types';

export class GitlabParser implements Parser {
    issueMovedType = 'issueMovedType';

    constructor(private features: Config['features'], private selectors: Selectors) {}

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

    actionFuncs = {
        postComment: this.isPostComment,
    };

    getBotActions(body) {
        return Object.keys(this.actionFuncs).filter(key => this.actionFuncs[key].bind(this)(body));
    }
}
