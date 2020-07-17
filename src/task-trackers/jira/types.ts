import { Selectors, Issue, Project } from '../../types';

interface UserData {
    self: string;
    avatarUrls: {
        '48x48': string;
        '24x24': string;
        '16x16': string;
        '32x32': string;
    };
    displayName: string;
    active: true;
    timeZone: string;
}

export interface Comment {
    self: string;
    id: string;
    author: {
        self: string;
        accountId: string;
        avatarUrls: {
            '48x48': string;
            '24x24': string;
            '16x16': string;
            '32x32': string;
        };
        displayName: string;
        active: boolean;
        timeZone: string;
    };
    body: string;
    updateAuthor: {
        self: string;
        accountId: string;
        avatarUrls: {
            '48x48': string;
            '24x24': string;
            '16x16': string;
            '32x32': string;
        };
        displayName: string;
        active: boolean;
        timeZone: string;
    };
    created: string;
    updated: string;
    jsdPublic: boolean;
}

export interface IssueLink {
    id: string;
    self: string;
    type: {
        id: string;
        name: string;
        inward: string;
        outward: string;
        self: string;
    };
    outwardIssue: {
        id: string;
        key: string;
        self: string;
        fields: {
            summary: string;
            status: {
                self: string;
                description: string;
                iconUrl: string;
                name: string;
                id: string;
                statusCategory: {
                    self: string;
                    id: 2;
                    key: string;
                    colorName: string;
                    name: string;
                };
            };
            priority: {
                self: string;
                iconUrl: string;
                name: string;
                id: string;
            };
            issuetype: {
                self: string;
                id: string;
                description: string;
                iconUrl: string;
                name: string;
                subtask: false;
                avatarId: number;
            };
        };
    };
}

export interface ChangelogItem {
    field: string;
    fieldtype: string;
    from: string | null;
    fromString: string;
    to: string | null;
    toString: string;
}

export interface Changelog {
    id: string;
    items: ChangelogItem[];
}

export interface JiraSelectors extends Selectors {
    getIssueColor(body): string;
    extractName(body, path?: string[]): string | undefined;
    getIssueMembers(body): string[];
    getComment(body): string | undefined;
    getEpicKey(body): string | undefined;
    getLinks(body): IssueLink[];
    getNameIssueLinkType(body): string | undefined;
    getIssueLinkDestinationId(body): string | undefined;
    getIssueLinkSourceId(body): string | undefined;
    getSourceRelation(body): string | undefined;
    getDestinationRelation(body): string | undefined;
    isEpic(body): boolean;
    getChangelogField(field: string, body): ChangelogItem | undefined;
    getNewSummary(body): string | undefined;
    getNewStatus(body): string | undefined;
    getNewStatusId(body): string | undefined;
    getNewKey(body): string | undefined;
    getOldKey(body): string | undefined;
    getRelations(body): any;
    getLinkKeys(body): string[];
    getInwardLinkKey(body): string | undefined;
    getOutwardLinkKey(body): string | undefined;
}

export interface JiraIssue extends Issue {
    expand: string;
    self: string;
    fields: {
        issuetype: {
            self: string;
            id: string;
            description: string;
            iconUrl: string;
            name: string;
            subtask: false;
            avatarId: number;
        };
        timespent: null;
        customfield_10030: null;
        project: {
            self: string;
            id: string;
            key: string;
            name: string;
            projectTypeKey: string;
            avatarUrls: {
                '48x48': string;
                '24x24': string;
                '16x16': string;
                '32x32': string;
            };
        };
        fixVersions: [];
        aggregatetimespent: null;
        resolution: null;
        resolutiondate: null;
        workratio: -1;
        watches: {
            self: string;
            watchCount: 1;
            isWatching: false;
        };
        lastViewed: null;
        created: string;
        customfield_10020: null;
        customfield_10021: [];
        priority: {
            self: string;
            iconUrl: string;
            name: string;
            id: string;
        };
        customfield_10025: null;
        labels: [];
        customfield_10026: null;
        customfield_10016: null;
        customfield_10017: null;
        customfield_10018: null;
        customfield_10019: string;
        aggregatetimeoriginalestimate: null;
        timeestimate: null;
        versions: [];
        issuelinks: IssueLink[];
        assignee: {
            self: string;
            accountId: string;
            avatarUrls: {
                '48x48': string;
                '24x24': string;
                '16x16': string;
                '32x32': string;
            };
            displayName: string;
            active: boolean;
            timeZone: string;
        };
        updated: string;
        status: {
            self: string;
            description: string;
            iconUrl: string;
            name: string;
            id: string;
            statusCategory: {
                self: string;
                id: 2;
                key: string;
                colorName: string;
                name: string;
            };
        };
        components: [];
        timeoriginalestimate: null;
        description: string;
        customfield_10055: null;
        customfield_10056: null;
        customfield_10057: null;
        customfield_10013: null;
        customfield_10014: null;
        customfield_10058: null;
        customfield_10015: {
            hasEpicLinkFieldDependency: false;
            showField: false;
            nonEditableReason: {
                reason: string;
                message: string;
            };
        };
        timetracking: {};
        customfield_10005: null;
        customfield_10006: null;
        security: null;
        customfield_10007: null;
        customfield_10008: null;
        customfield_10009: null;
        aggregatetimeestimate: null;
        attachment: [];
        summary: string;
        creator: {
            self: string;
            accountId: string;
            avatarUrls: {
                '48x48': string;
                '24x24': string;
                '16x16': string;
                '32x32': string;
            };
            displayName: string;
            active: boolean;
            timeZone: string;
        };
        subtasks: [];
        customfield_10040: null;
        customfield_10041: null;
        reporter: {
            self: string;
            accountId: string;
            avatarUrls: {
                '48x48': string;
                '24x24': string;
                '16x16': string;
                '32x32': string;
            };
            displayName: string;
            active: boolean;
            timeZone: string;
        };
        aggregateprogress: {
            progress: number;
            total: number;
        };
        customfield_10000: string;
        customfield_10001: null;
        customfield_10002: null;
        customfield_10003: null;
        customfield_10004: null;
        customfield_10039: null;
        environment: null;
        duedate: null;
        progress: {
            progress: number;
            total: number;
        };
        votes: {
            self: string;
            votes: number;
            hasVoted: false;
        };
        comment: {
            comments: Comment[];
            maxResults: number;
            total: number;
            startAt: number;
        };
        worklog: {
            startAt: number;
            maxResults: number;
            total: number;
            worklogs: [];
        };
    };
}

export interface RenderedIssue extends JiraIssue {
    renderedFields: {
        issuetype: string | null;
        timespent: string | null;
        customfield_10030: string | null;
        project: string | null;
        fixVersions: string | null;
        aggregatetimespent: string | null;
        resolution: string | null;
        resolutiondate: string | null;
        workratio: string | null;
        lastViewed: string;
        watches: string | null;
        created: string;
        customfield_10020: string | null;
        customfield_10021: string | null;
        priority: string | null;
        customfield_10025: string | null;
        labels: string | null;
        customfield_10026: string | null;
        customfield_10016: string | null;
        customfield_10017: string | null;
        customfield_10018: string | null;
        customfield_10019: string | null;
        aggregatetimeoriginalestimate: string | null;
        timeestimate: string | null;
        versions: string | null;
        issuelinks: string | null;
        assignee: string | null;
        updated: string;
        status: string | null;
        components: string | null;
        timeoriginalestimate: string | null;
        description: string;
        customfield_10055: string;
        customfield_10056: string | null;
        customfield_10013: string | null;
        customfield_10057: string | null;
        customfield_10058: string | null;
        customfield_10014: string | null;
        timetracking: {};
        customfield_10015: string | null;
        customfield_10005: string;
        customfield_10006: string | null;
        security: string | null;
        customfield_10007: string | null;
        customfield_10008: string | null;
        attachment: [];
        customfield_10009: string | null;
        aggregatetimeestimate: string | null;
        summary: string | null;
        creator: string | null;
        subtasks: string | null;
        customfield_10040: string;
        customfield_10041: string;
        reporter: string | null;
        customfield_10000: string | null;
        aggregateprogress: string | null;
        customfield_10001: string | null;
        customfield_10002: string | null;
        customfield_10003: string | null;
        customfield_10004: string | null;
        customfield_10039: string;
        environment: string;
        duedate: string | null;
        progress: string | null;
        votes: string | null;
        comment: {
            comments: Comment[];
        };
    };
}

export interface JiraProject extends Project {
    id: string;
    issueTypes: Array<{ id: string; name: string; description: string; subtask: any }>;
    adminsURL: string;
    style: string;
    admins?: string[];
}
