import {
    Config,
    PostCommentData,
    CreateRoomData,
    PostEpicUpdatesData,
    PostIssueUpdatesData,
    Issue,
    InviteNewMembersData,
    PostLinkedChangesData,
    PostNewLinksData,
    PostProjectUpdatesData,
    Parser,
} from '../../types';
import { JiraSelectors } from './types';

export class JiraParser implements Parser {
    issueMovedType = 'issue_moved';

    constructor(private features: Config['features'], private selectors: JiraSelectors) {}

    getBotActions(body: any): string[] {
        return Object.keys(this.actionFuncs).filter(key => this.actionFuncs[key].bind(this)(body));
    }

    actionFuncs = {
        postIssueUpdates: this.isPostIssueUpdates,
        inviteNewMembers: this.isMemberInvite,
        postComment: this.isPostComment,
        postEpicUpdates: this.isPostEpicUpdates,
        postProjectUpdates: this.isPostProjectUpdates,
        postNewLinks: this.isPostNewLinks,
        postLinkedChanges: this.isPostLinkedChanges,
        postLinksDeleted: this.isDeleteLinks,
    };

    getPostCommentData(body): PostCommentData {
        const headerText = this.selectors.getHeaderText(body)!;
        const author = this.selectors.getDisplayName(body)!;
        const issueId = this.selectors.getIssueId<Issue>(body)!;
        const comment = this.selectors.getCommentBody(body);

        return { issueId, headerText, comment, author };
    }

    getCreateRoomData(body): CreateRoomData {
        const projectKey = this.selectors.getProjectKey(body);
        const summary = this.selectors.getSummary(body);
        const key = this.selectors.getIssueKey(body);
        const id = this.selectors.getIssueId(body);
        const descriptionFields = this.selectors.getDescriptionFields(body);

        const parsedIssue = { key, id, summary, projectKey, descriptionFields };

        return { issue: parsedIssue, projectKey: this.features.createProjectRoom ? projectKey : undefined };
    }

    getInviteNewMembersData(body): InviteNewMembersData {
        const key = this.selectors.getKey(body)!;
        const projectKey = this.selectors.getProjectKey(body)!;
        const descriptionFields = this.selectors.getDescriptionFields(body);

        return { key, typeName: descriptionFields?.typeName, projectKey };
    }

    getPostNewLinksData(body): PostNewLinksData {
        const allLinks = this.selectors.getLinks(body);
        const links = allLinks.map(link => (link ? link.id : link));

        return { links };
    }

    getPostEpicUpdatesData(body): PostEpicUpdatesData {
        const epicKey = this.selectors.getEpicKey(body)!;
        const id = this.selectors.getIssueId(body);
        const key = this.selectors.getKey(body)!;
        const summary = this.selectors.getSummary(body)!;
        const status = this.selectors.getNewStatus(body);
        const name = this.selectors.getDisplayName(body)!;

        const data = { key, summary, id, name, status };

        return { epicKey, data };
    }

    getPostLinkedChangesData(body): PostLinkedChangesData {
        const changes = this.selectors.getIssueChanges(body)!;
        const key = this.selectors.getKey(body)!;
        const status = this.selectors.getNewStatus(body);
        const summary = this.selectors.getSummary(body)!;
        const name = this.selectors.getDisplayName(body)!;
        const linksKeys = this.selectors.getLinkKeys(body);

        const data = { status, key, summary, changes, name };

        return { linksKeys, data };
    }

    getPostProjectUpdatesData(body): PostProjectUpdatesData {
        const typeEvent = this.selectors.getTypeEvent(body) as PostProjectUpdatesData['typeEvent'];
        const projectKey = this.selectors.getProjectKey(body)!;
        const name = this.selectors.getDisplayName(body);
        const summary = this.selectors.getSummary(body)!;
        const status = this.selectors.getNewStatus(body);
        const key = this.selectors.getKey(body)!;

        const data = { key, summary, name, status };

        return { typeEvent, projectKey, data };
    }

    getPostIssueUpdatesData(body): PostIssueUpdatesData {
        const author = this.selectors.getDisplayName(body)!;
        const changes = this.selectors.getIssueChanges(body)!;
        const newKey = this.selectors.getNewKey(body);
        const oldKey = (this.selectors.getOldKey(body) || this.selectors.getKey(body))!;
        const newNameData = newKey
            ? { key: newKey, summary: this.selectors.getSummary(body)! }
            : typeof this.selectors.getNewSummary(body) === 'string'
            ? { key: oldKey, summary: this.selectors.getNewSummary(body)! }
            : undefined;
        const newRoomName =
            newNameData && this.selectors.composeRoomName(newNameData.key, { summary: newNameData.summary });
        const newStatusId = this.selectors.getNewStatusId(body);
        const isNewStatus = Boolean(newStatusId);
        const projectKey = this.selectors.getProjectKey(body)!;

        return { oldKey, newKey, newRoomName, changes, author, newStatusId, projectKey, isNewStatus };
    }

    getPostLinksDeletedData(body) {
        return {
            sourceIssueId: this.selectors.getIssueLinkSourceId(body),
            destinationIssueId: this.selectors.getIssueLinkDestinationId(body),
            sourceRelation: this.selectors.getSourceRelation(body),
            destinationRelation: this.selectors.getDestinationRelation(body),
        };
    }

    isPostComment(body) {
        return Boolean(this.features.postComments && this.selectors.isCommentEvent(body));
    }

    isPostIssueUpdates(body) {
        return Boolean(
            this.features.postIssueUpdates &&
                this.selectors.isCorrectWebhook(body, 'jira:issue_updated') &&
                this.selectors.getIssueChanges(body),
        );
    }

    isCreateRoom(body) {
        return Boolean(
            this.features.createRoom &&
                this.selectors.getKey(body) &&
                this.selectors.getTypeEvent(body) !== this.issueMovedType,
        );
    }

    isMemberInvite(body) {
        return (
            this.features.inviteNewMembers &&
            this.selectors.isCorrectWebhook(body, 'jira:issue_updated') &&
            this.selectors.getTypeEvent(body) !== this.issueMovedType
        );
    }

    isPostEpicUpdates(body) {
        return Boolean(
            this.features.epicUpdates.on() &&
                (this.selectors.isCorrectWebhook(body, 'jira:issue_updated') ||
                    (this.selectors.isCorrectWebhook(body, 'jira:issue_created') &&
                        this.selectors.getIssueChanges(body))) &&
                this.selectors.getEpicKey(body),
        );
    }

    isPostProjectUpdates(body) {
        return (
            this.features.epicUpdates.on() &&
            (this.selectors.isCorrectWebhook(body, 'jira:issue_updated') ||
                this.selectors.isCorrectWebhook(body, 'jira:issue_created')) &&
            this.selectors.isEpic(body) &&
            (this.selectors.getTypeEvent(body) === 'issue_generic' ||
                this.selectors.getTypeEvent(body) === 'issue_created')
        );
    }

    isPostNewLinks(body) {
        return (
            (this.features.newLinks &&
                (this.selectors.isCorrectWebhook(body, 'jira:issue_updated') ||
                    this.selectors.isCorrectWebhook(body, 'jira:issue_created')) &&
                this.selectors.getLinks(body).length > 0) ||
            this.selectors.getBodyWebhookEvent(body) === 'issuelink_created'
        );
    }

    isPostLinkedChanges(body) {
        return Boolean(
            this.features.postChangesToLinks.on &&
                this.selectors.isCorrectWebhook(body, 'jira:issue_updated') &&
                this.selectors.getIssueChanges(body) &&
                this.selectors.getLinks(body).length > 0 &&
                typeof this.selectors.getNewStatus(body) === 'string',
        );
    }

    isDeleteLinks(body) {
        return this.selectors.getBodyWebhookEvent(body) === 'issuelink_deleted';
    }
}
