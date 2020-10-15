import { BaseChatApi } from '../messengers/base-api';
import { GitlabPushCommit, GitlabPipeline, GitlabLabelHook } from '../task-trackers/gitlab/types';

export interface DefaultLabel {
    name: string;
    // description: string;
    // color: string;
}

export interface Config {
    port: string;
    lang: 'en' | 'ru';
    pathToDocs: string;
    taskTracker: {
        type: 'jira' | 'gitlab';
        url: string;
        user: string;
        password: string;
        defaultLabel?: DefaultLabel;
    };
    features: {
        createRoom: boolean;
        createProjectRoom?: boolean;
        inviteNewMembers: boolean;
        postComments: boolean;
        postEachComments?: boolean;
        postIssueUpdates: boolean;
        postMilestoneUpdates?: boolean;
        epicUpdates: {
            newIssuesInEpic: 'on' | 'off';
            issuesStatusChanged: 'on' | 'off';
            field: string;
            fieldAlias: string;
            on: () => boolean;
        };
        newLinks: boolean;
        postChangesToLinks: {
            on: boolean;
            ignoreDestStatusCat: number[];
        };
    };
    usersToIgnore: string[];
    inviteIgnoreUsers: string[];
    testMode: {
        on: boolean;
        users: string[];
    };
    redis: {
        host: string;
        port: number;
        prefix: string;
    };
    messenger: {
        admins: string[];
        name: 'matrix' | 'slack';
        domain: string;
        user: string;
        password: string;
        // slack only
        eventPort?: number;
        bots: {
            user: string;
            password: string;
            isMaster?: true;
        }[];
        infoRoom?: {
            users?: string[];
            name: string;
        };
    };
    log: {
        type: string;
        filePath: string;
        fileLevel: string;
        consoleLevel: string;
    };
    ping: {
        interval: number;
        count: number;
    };
    colors: {
        //
        // links: {
        //     issue: string;
        //     green: string;
        //     yellow: string;
        //     'blue-gray': string;
        //     purple: string;
        // };
        projects: string[] | 'all';
    };
    gitArchive?: {
        user: string;
        password: string;
        repoPrefix: string;
        protocol: 'http' | 'https';
        options?: {
            lastIssue: string[];
        };
    };
    baseDir: string;
    // delay interval for archiving rooms and other high loadly chat server operations
    delayInterval: number;
    baseRemote?: string;
    baseLink?: string;
    sshLink?: string;
    gitReposPath?: string;
    ignoreCommands: string[];
    maxFileSize: number;
}

export interface ChatConfig extends Config {
    user: string;
    password: string;
    isMaster?: true;
}

export interface Issue {
    id: string | number;
    key: string;
}

export interface Transition {
    id: string;
    name: string;
    to: {
        self: string;
        description: string;
        iconUrl: string;
        name: string;
        id: string;
        statusCategory: {
            self: string;
            id: 1;
            key: string;
            colorName: string;
            name: string;
        };
    };
    hasScreen: false;
    isGlobal: false;
    isInitial: false;
    isConditional: false;
    fields: {
        summary: {
            required: false;
            schema: {
                type: string;
                items: string;
                custom: string;
                customId: 10001;
            };
            name: string;
            key: string;
            hasDefaultValue: false;
            operations: string[];
            allowedValues: string[];
            defaultValue: string;
        };
    };
}

export interface Project {
    key: string;
    id: string | number;
    name: string;
    lead: string;
    isIgnore: boolean;
}

export interface Relation {
    relation: any;
    related: any;
}

export interface DescriptionFields {
    assigneeName: string;
    reporterName: string;
    typeName: string;
    epicLink: string;
    estimateTime: string;
    description: string;
    priority: string;
}

export enum RoomViewStateEnum {
    close = 'close',
    open = 'open',
}

export enum MilestoneStateEnum {
    close = 'close',
    open = 'active',
}

export interface Selectors {
    getMilestoneViewUrl(body: Issue): string;

    getMilestoneRoomName(body: Issue): string | undefined;

    isIssueRoomName(name: string): boolean;

    getMilestoneKey(body: Issue, milestoneId?: number): string | undefined;

    getRoomName(body): string;

    // getMilestoneRoomName(body): string;

    composeRoomName(key: string, options: { summary: string; state?: RoomViewStateEnum; milestone?: string }): string;

    getIssueChanges(body): IssueChanges[] | undefined;

    getCreator(body): string | undefined;

    getDescriptionFields(body): DescriptionFields | undefined;

    getBodyWebhookEvent(body): string | undefined;

    getTypeEvent(body): string | undefined;

    getIssueCreator(body): string | undefined;

    getHookType(body): string | undefined;

    getIssueMembers(body): string[];

    getDisplayName(body): string | undefined;

    getMembers(body): string | undefined;

    getIssueId<Issue>(body): string;
    getIssueId<T>(body: T): string | undefined;

    getIssueKey(body): string;

    getIssueName(body): string | undefined;

    getProjectKey(body, type: 'issue'): string;
    getProjectKey(body, type?: 'issue'): string | undefined;

    getCommentBody(body): { body: string; id: string | number };

    getKey(body): string | undefined;

    // getLinks(body): IssueLink[];

    // getChangelog(body): Changelog | undefined;

    // getEpicKey(body): string | undefined;

    // getIssueLinkSourceId(body): string | undefined;

    // getIssueLinkDestinationId(body): string | undefined;

    // getNameIssueLinkType(body): string | undefined;

    // getSourceRelation(body): string | undefined;

    // getDestinationRelation(body): string | undefined;

    getSummary(body): string | undefined;

    getMilestoneSummary(body): string | undefined;

    getBodyTimestamp(body): string | number | undefined;

    getRedisKey(funcName: string, body: any): string;

    isCorrectWebhook(body: any, hookName: any): boolean;

    isCommentEvent(body): boolean;

    getHeaderText(body): string | undefined;
}

export interface IssueWithComments {
    key: string;
    comments: { id: string | number; body: string }[];
}

export interface TaskTracker {
    selectors: Selectors;

    parser: Parser;

    init(): TaskTracker;

    createLink(urlRoom: string, body: string);

    getMilestoneUrl(body: any): string | undefined;

    getMilestoneWatchers(key): Promise<string[]>;

    sendMessage(key: string, body: string): Promise<any>;

    getCurrentIssueColor(key: string, hookLabels?: GitlabLabelHook[]): Promise<string | string[]>;

    getIssueFieldsValues(key: string, fields: string[]): Promise<any>;

    getStatusColor(data: {
        statusId: string | number;
        issueKey: string;
        hookLabels?: GitlabLabelHook[];
    }): Promise<string | undefined | string[]>;

    checkIgnoreList(ignoreList, hookType, taskType, body): boolean;

    getKeyOrIdForCheckIgnore(body): Promise<string> | string | string[];

    isAvoidHookType(type?: string): boolean;

    postComment(
        keyOrId: string,
        senderData: { sender: string; senderDisplayName: string | undefined },
        bodyText: string,
    ): Promise<any>;

    // /**
    //  * Set issue to special transition
    //  */
    // postIssueStatus(keyOrId: string, id: string): Promise<void>;

    // /**
    //  * Get all issue transitions
    //  */
    // getPossibleIssueStatuses(keyOrId: string): Promise<object[]>;

    // /**
    //  * Get all issue priorities
    //  */
    // getIssuePriorities(keyOrId: string): Promise<object[] | undefined>;

    // /**
    //  * Update issue priorities
    //  */
    // updateIssuePriority(keyOrId: string, priorityId: string): Promise<void>;

    /**
     * Ping tasktracker
     */
    testJiraRequest(): Promise<void>;

    /**
     * Make jira request to get all watchers, assign, creator and reporter of issue from url
     */
    getIssueWatchers(keyOrId: string): Promise<{ displayName: string; userId?: string }[]>;

    // /**
    //  * Make GET request to jira by ID to get linked issues
    //  */
    // getLinkedIssue(id: string): Promise<Issue>;

    /**
     * Make GET request to jira by key or id
     */
    getIssue(keyOrId: string | number): Promise<Issue>;

    // /**
    //  * Create link with issue
    //  */
    // createEpicLinkClassic(issueKey: string, parentId: string): Promise<void>;

    // /**
    //  * Create issue link
    //  */
    // createIssueLink(issueKey1: string, issueKey2: string): Promise<void>;

    /**
     * Make GET request to jira by project id or key
     */
    getProject(keyOrId: string): Promise<Project>;

    // /**
    //  * Check if project with such key or id exists
    //  */
    // isJiraPartExists(keyOrId: string): Promise<boolean>;

    // /**
    //  * Make GET request to jira by projectID
    //  */
    // getProjectWithAdmins(projectKey: string): Promise<Project>;

    /**
     * Get issue comments collection
     */
    getIssueComments(issueId: string): Promise<IssueWithComments>;

    // /**
    //  * Make request to jira by issueId adding renderedFields
    //  */
    // getIssueFormatted(issueId: string): Promise<RenderedIssue>;

    // /**
    //  * Make request to jira by issueId adding renderedFields and filter by fields
    //  */
    // getIssueFieldsValues(key: string, fields: string[]): Promise<any>;

    // /**
    //  * Get user list by part of the name
    //  */
    // searchUser(partName?: string): Promise<{ displayName: string; accountId: string }[]>;

    // /**
    //  * Add watcher to issue
    //  */
    // addWatcher(accountId: string, keyOrId: string): Promise<void>;

    // /**
    //  * Add assign to issue
    //  */
    // addAssignee(accountId: string, keyOrId: string): Promise<void>;

    /**
     * Get issue without throw on error
     */
    getIssueSafety(keyOrId: string): Promise<Issue | false>;

    /**
     * Check if issue exists
     */
    hasIssue(keyOrId: string): Promise<boolean>;

    // /**
    //  * Get status data with color
    //  */
    // getStatusData(statusId: string): Promise<{ colorName: string | undefined } | undefined>;

    // /**
    //  * Get last created issue key in project
    //  */
    // getLastIssueKey(projectKey: string): Promise<string | undefined>;

    // /**
    //  * Check if status exists in project
    //  */
    // hasStatusInProject(projectKey: string, status: string): Promise<boolean>;

    // /**
    //  * Get issue current status
    //  */
    // getCurrentStatus(keyOrId: string): Promise<string | undefined>;

    /**
     * Get url for rest api
     */
    getRestUrl(...args: (string | number)[]): string;

    /**
     * Get link to view in browser
     */
    getViewUrl(key: string, type?: string): string;

    isIgnoreHook(body): Promise<boolean> | boolean;
}

interface CommonMessengerApi {
    /**
     * Transform ldap user name to chat user id
     */
    getChatUserId(shortName: string): string;

    /**
     * Get room id by name
     */
    getRoomIdByName(name: string, notUpper?: boolean): Promise<string | false>;

    /**
     * Set new topic for matrix room
     */
    setRoomTopic(roomId: string, topic: string): Promise<void>;

    /**
     *  disconnected Chat client
     */
    disconnect(): void;

    /**
     */
    getRoomId(name: string): Promise<string>;

    /**
     */
    getRoomMembers(data: { name: string; roomId?: string }): Promise<string[]>;

    /**
     * Invite user to chat room
     */
    invite(roomId: string, userId: string): Promise<boolean>;

    /**
     * Send message to chat room
     */
    sendHtmlMessage(roomId: string, body: string, htmlBody: string): Promise<void>;

    /**
     * Send message to chat room
     */
    sendTextMessage(roomId: string, body: string): Promise<void>;

    /**
     * Update room name
     */
    updateRoomName(roomId: string, newRoomName: string): Promise<void>;

    /**
     * Update room info data
     */
    updateRoomData(roomId: string, topic: string, key: string): Promise<void>;

    /**
     * Get bot which joined to room in chat
     */
    setRoomAvatar(roomId: string, url: string): Promise<true | undefined>;

    /**
     * Get chat id by displayName
     */
    getUserIdByDisplayName(name: string): Promise<any>;

    /**
     * Kick bot from a roon
     */
    kickUserByRoom(data: { roomId: string; userId: string }): Promise<string | undefined>;

    /**
     * Get all room events
     */
    getAllEventsFromRoom(roomId: string, limit?: number): Promise<any[] | undefined>;

    /**
     * Get room id, throws if no bot is in room
     */
    getRoomDataById(roomId: string): Promise<RoomData | undefined>;
}

export interface CreateRoomOpions {
    room_alias_name: string;
    invite: string[];
    name: string;
    topic?: string;
    purpose?: string;
    avatarUrl?: string;
}

export interface MessengerApi extends CommonMessengerApi, BaseChatApi {
    /**
     * Get link for room by id or alias
     */
    getRoomLink(idOrAlias: string): string;

    /**
     * Upload content to messenger
     */
    uploadContent(data: Buffer, imageType: string): Promise<string>;

    /**
     * Create room alias
     */

    createAlias(name, roomId): Promise<string | false>;
    /**
     * Get link to download media
     */
    getDownloadLink(chatLink: string): string;

    /**
     * Upload file by url to room
     */
    upload(roomId: string, url: string): Promise<string | undefined>;

    /**
     * Delete matrix room alias
     * @param {string} aliasPart matrix room id
     */
    deleteRoomAlias(aliasPart: string): Promise<string | void>;

    /**
     * @param {string} roomId room id
     */
    setRoomJoinedByUrl(roomId: string): Promise<true | undefined>;

    /**
     * Get bot which joined to room in chat
     */
    getUser(userId: string): Promise<{ displayName: string; avatarUrl: string } | undefined>;

    /**
     * Join Room
     */
    joinRoom(data: { roomId?: string; aliasPart: string }): Promise<void>;

    /**
     * Get matrix room by alias
     */
    getRoomAdmins(data: { name?: string; roomId?: string }): Promise<{ name: string; userId: string }[]>;

    /**
     * Get all messeges from room
     */
    getAllMessagesFromRoom(
        roomId: string,
    ): Promise<{ author: string; date: string; body: string; eventId: string }[] | undefined>;

    /**
     * Set new name for chat room
     */
    setRoomName(roomId: string, name: string): Promise<boolean>;

    /**
     * Create room name for chat
     */
    composeRoomName(key: string, summary: string): string;

    connect(): Promise<void>;

    isConnected(): boolean;

    /**
     * Set power level for current user in chat room
     */
    setPower(roomId: string, userId: string): Promise<boolean>;

    /**
     * Create chat room
     */
    createRoom(options: CreateRoomOpions): Promise<string>;

    /**
     * Check if user is in room
     */
    isInRoom(roomId: string): Promise<boolean>;

    leaveRoom(roomId: string): Promise<string | false>;

    getRooms(): Array<any>;

    /**
     * Check if user is in matrix room
     */
    isRoomMember(roomId: string, user: string): Promise<boolean>;
}

export interface RoomData {
    id: string;
    alias: string | string | null;
    name: string;
    topic?: string;
    members: {
        userId: string;
        powerLevel: number;
    }[];
}

export interface CreateRoomData {
    issue: {
        key: string;
        id?: string;
        summary?: string;
        projectKey?: string;
        hookLabels?: GitlabLabelHook[];
        descriptionFields?: DescriptionFields;
    };
    projectKey?: string;
    milestoneId?: number;
}

export interface InviteNewMembersData {
    key: string;
    typeName?: string;
    projectKey?: string;
}

export interface IssueChanges {
    field: string;
    newValue: string;
}

export interface PostIssueUpdatesData {
    newStatusId?: number | string;
    oldKey: string;
    newKey?: string;
    newRoomName?: string;
    changes: IssueChanges[];
    author: string;
    projectKey: string;
    hookLabels?: GitlabLabelHook[];
    isNewStatus?: boolean;
}

export interface PostPipelineData {
    pipelineData: {
        header: string;
        key: string;
        pipeInfo: GitlabPipeline;
    }[];
    author: string;
}

export interface PushCommitData {
    // projectNamespace: string;
    keyAndCommits: Record<string, GitlabPushCommit[]>;
    author: string;
}

export interface PostEpicUpdatesData {
    epicKey: string;
    data: { key: string; summary: string; id: string; name: string; status?: string };
}

export enum MilestoneUpdateStatus {
    Created = 'created',
    Closed = 'closed',
    Deleted = 'deleted',
    Reopen = 'reopen',
}

export interface PostMilestoneUpdatesData {
    milestoneId: number;
    issueKey: string;
    user: string;
    status: MilestoneUpdateStatus;
    summary: string;
}
export interface PostProjectUpdatesData {
    typeEvent: 'issue_created' | 'issue_generic';
    projectKey: string;
    data: {
        summary: string;
        key: string;
        status?: string;
        name?: string;
    };
}

export interface ArchiveProjectData {
    projectKey: string;
    keepTimestamp: string;
    status?: string;
}

export interface PostNewLinksData {
    links: string[];
}

export interface UploadData {
    issueKey: string;
    uploadInfo: string;
    uploadUrls: string[];
}

export interface PostCommentData {
    issueId: string;
    headerText: string;
    comment: {
        id: string | number;
        body: string;
    };
    author: string;
}

export interface PostLinkedChangesData {
    linksKeys: string[];
    data: {
        status?: string;
        key: string;
        summary: string;
        changes: IssueChanges[];
        name: string;
    };
}

export interface DeletedLinksData {
    sourceIssueId: string;
    destinationIssueId: string;
    sourceRelation: string;
    destinationRelation: string;
}

export interface CommandOptions {
    sender: string;
    roomName: string | null;
    roomId: string;
    bodyText?: string;
    roomData: RoomData;
    url?: string;
    senderDisplayName?: string;
}

export enum CommandNames {
    Comment = 'comment',
    Assign = 'assign',
    Move = 'move',
    Spec = 'spec',
    Prio = 'prio',
    Op = 'op',
    Invite = 'invite',
    Help = 'help',
    Ignore = 'ignore',
    Create = 'create',
    Autoinvite = 'autoinvite',
    Alive = 'alive',
    GetInfo = 'getInfo',
    Kick = 'kick',
    Archive = 'archive',
    Projectarchive = 'projectarchive',
    Upload = 'upload',
}

export interface RunCommandsOptions extends CommandOptions {
    chatApi: MessengerApi;
}

export enum ActionNames {
    CreateRoom = 'createRoom',
    InviteNewMembers = 'inviteNewMembers',
    PostComment = 'postComment',
    PostIssueUpdates = 'postIssueUpdates',
    PostEpicUpdates = 'postEpicUpdates',
    PostProjectUpdates = 'postProjectUpdates',
    PostNewLinks = 'postNewLinks',
    PostLinkedChanges = 'postLinkedChanges',
    PostLinksDeleted = 'postLinksDeleted',
    ArchiveProject = 'archiveProject',
    Upload = 'upload',
    PostCommit = 'postPushCommit',
    Pipeline = 'postPipeline',
    PostMilestoneUpdates = 'postMilestoneUpdates',
}

export interface Parser {
    issueMovedType: string;

    getCreateRoomData(body): CreateRoomData;

    isCreateRoom(body): boolean;

    getBotActions(body): string[];

    getPostCommentData(body): PostCommentData;

    isPostComment(body): boolean;

    isMemberInvite(body): boolean;

    getInviteNewMembersData(body): InviteNewMembersData;

    getPostIssueUpdatesData(body): PostIssueUpdatesData;

    isPostIssueUpdates(body): boolean;
}
