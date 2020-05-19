export interface Config {
    port: string;
    lang: 'en' | 'ru';
    pathToDocs: string;
    jira: {
        url: string;
        user: string;
        password: string;
    };
    features: {
        createRoom: boolean;
        inviteNewMembers: boolean;
        postComments: boolean;
        postIssueUpdates: boolean;
        epicUpdates: {
            newIssuesInEpic: 'on' | 'off';
            issuesStatusChanged: 'on' | 'off';
            field: string;
            fieldAlias: string;
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
        bots: {
            user: string;
            password: string;
        }[];
        infoRoom: {
            users: string[];
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
        links: {
            issue: string;
            green: string;
            yellow: string;
            'blue-gray': string;
            purple: string;
        };
        projects: ['TEST'];
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
}

export interface Issue {
    key: string;
    id: string;
    descriptionFields: object;
}

export interface Project {
    key: string;
    id: number;
    name: string;
    lead: string;
    admins?: string[];
}

export interface TaskTracker {
    request(url: string, newOptions: any): Promise<any>;

    requestPost(url: string, body: any): Promise<any>;

    requestPut(url: string, body: any): Promise<any>;

    postComment(keyOrId: string, sender: string, bodyText: string): Promise<any>;

    /**
     * Set issue to special transition
     */
    postIssueStatus(keyOrId: string, id: string): Promise<void>;

    /**
     * Get all issue transitions
     */
    getPossibleIssueStatuses(keyOrId: string): Promise<object[]>;

    /**
     * Get all issue priorities
     */
    getIssuePriorities(keyOrId: string): Promise<object[]>;

    /**
     * Update issue priorities
     */
    updateIssuePriority(keyOrId: string, priorityId: string): Promise<void>;

    /**
     * Ping tasktracker
     */
    testJiraRequest(): Promise<void>;

    /**
     * Make jira request to get all watchers, assign, creator and reporter of issue from url
     */
    getIssueWatchers(keyOrId: string): Promise<string[]>;

    /**
     * Make GET request to jira by ID to get linked issues
     */
    getLinkedIssue(id: string): Promise<Issue>;

    /**
     * Make GET request to jira by issueID and params
     */
    getIssue(keyOrId: string, params?: object): Promise<Issue>;

    /**
     * Create issue
     */
    createIssue(data: {
        summary: string;
        issueTypeId: string;
        projectId: string;
        parentId: string;
        isEpic: boolean;
        isSubtask: boolean;
        styleProject: string;
    }): Promise<Issue>;

    /**
     * Create link with issue
     */
    createEpicLinkClassic(issueKey: string, parentId: string): Promise<void>;

    /**
     * Create issue link
     */
    createIssueLink(issueKey1: string, issueKey2: string): Promise<void>;

    /**
     * Make GET request to jira by project id or key
     */
    getProject(
        keyOrId: string,
    ): Promise<{
        key: string;
        id: number;
        name: string;
        lead: string;
        issueTypes: Array<{ id: number; name: string; description: string; subtask: any }>;
        adminsURL: string;
        isIgnore: boolean;
        style: string;
    }>;

    /**
     * Check if project with such key or id exists
     */
    isJiraPartExists(keyOrId: string): Promise<boolean>;

    /**
     * Make GET request to jira by projectID
     */
    getProjectWithAdmins(projectKey: string): Promise<Project>;

    /**
     * Make request to jira by issueID adding renderedFields
     */
    getIssueFormatted(issueID: string): Promise<object>;

    /**
     * Make request to jira by issueID adding renderedFields and filter by fields
     */
    getRenderedValues(key: string, fields: object): Promise<object & { description: object }>;

    /**
     * Get user list by part of the name
     */
    searchUser(partName?: string): Promise<object[]>;

    /**
     * Add watcher to issue
     */
    addWatcher(accountId: string, keyOrId: string): Promise<void>;

    /**
     * Add assign to issue
     */
    addAssignee(accountId: string, keyOrId: string): Promise<void>;

    /**
     * Get issue without throw on error
     */
    getIssueSafety(keyOrId: string): Promise<Issue | boolean>;

    /**
     * Check if issue exists
     */
    hasIssue(keyOrId: string): Promise<boolean>;

    /**
     * Get status data with color
     */
    getStatusData(statusId: string): Promise<object>;

    /**
     * Get last created issue key in project
     */
    getLastIssueKey(projectKey: string): Promise<string | undefined>;

    /**
     * Check if status exists in project
     */
    hasStatusInProject(projectKey: string, status: string): Promise<boolean>;

    /**
     * Get issue current status
     */
    getCurrentStatus(keyOrId: string): Promise<string>;
}

export interface MessengerApi {
    getAdmins(): string[];

    getMyId(): string;

    isMaster(): boolean;

    getNotifyData(): { name: string; users: string[] } | undefined;

    getCommandRoomName(): string | undefined;

    /**
     * Create room name for chat
     */
    composeRoomName(key: string, summary: string): string;

    /**
     * Transform ldap user name to chat user id
     */
    getChatUserId(shortName: string): string;

    isConnected(): boolean;

    /**
     * Get room id by name
     */
    getRoomIdByName(name: string): Promise<string | false>;

    /**
     * Set new topic for matrix room
     */
    setRoomTopic(roomId: string, topic: string): Promise<boolean>;

    /**
     * Set new name for chat room
     */
    setRoomName(roomId: string, name: string): Promise<boolean>;

    connect(): Promise<void>;

    /**
     *  disconnected Chat client
     */
    disconnect(): void;

    /**
     * Set power level for current user in chat room
     */
    setPower(roomId: string, userId: string): Promise<boolean>;

    /**
     * Create chat room
     */
    createRoom(options: {
        room_alias_name: string;
        invite: string[];
        name: string;
        topic?: string;
        purpose?: string;
        avatarUrl?: string;
    }): Promise<string>;

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
     * Update room name
     */
    updateRoomName(roomId: string, roomData: { key: string; summary: string }): Promise<void>;

    /**
     * Update room info data
     */
    updateRoomData(roomId: string, topic: string, key: string): Promise<void>;

    /**
     * Check if user is in room
     */
    isInRoom(roomId: string): Promise<boolean>;

    /**
     * Get bot which joined to room in chat
     */
    setRoomAvatar(roomId: string, url: string): Promise<void>;

    /**
     * Get chat id by displayName
     */
    getUserIdByDisplayName(name: string): Promise<any>;

    /**
     * Get matrix room by alias
     */
    getRoomAdmins(data: { name?: string; roomId?: string }): Promise<string[]>;

    /**
     * Get bot which joined to room in chat
     */
    getUser(userId: string): Promise<{ displayname: string; avatarUrl: string } | undefined>;

    /**
     * Get all messeges from room
     */
    getAllMessagesFromRoom(roomId: string): Promise<{ author: string; date: string; body: string; eventId: string }[]>;

    /**
     * Get bot which joined to room in chat
     */
    kickUserByRoom(data: { roomId: string; userId: string }): Promise<void>;

    /**
     * Get bot which joined to room in chat
     */
    getDownloadLink(chatLink: string): Promise<string>;

    /**
     * Delete matrix room alias
     * @param {string} aliasPart matrix room id
     */
    deleteRoomAlias(aliasPart: string): Promise<void>;

    /**
     * Get all room events
     */
    getAllEventsFromRoom(roomId: string, limit?: number): Promise<any[]>;

    /**
     * Get room id, throws if no bot is in room
     */
    getRoomDataById(roomId: string): Promise<RoomData | undefined>;

    /**
     * @param {string} roomId room id
     */
    setRoomJoinedByUrl(roomId: string): Promise<true | undefined>;

    /**
     * Join Room
     */
    joinRoom(data: { roomId?: string; aliasPart: string }): Promise<void>;
}

export interface RoomData {
    id: string;
    alias: string | null;
    name: string;
    topic?: string;
    members: {
        userId: string;
        powerLevel: number;
    };
}

export interface MessengerFasade extends MessengerApi {
    /**
     * Get room data and client instance in this room by roomId
     */
    getRoomAndClient(roomId: string): Promise<{ client: MessengerApi; roomData: RoomData } | undefined>;

    /**
     * Get room id, throws if no bot is in room
     */
    getRoomIdForJoinedRoom(key: string): Promise<string>;
}

export interface BaseActions {
    chatApi: MessengerFasade;
    config: Config;
    taskTracker: TaskTracker;
}

export interface CreateRoomActions extends BaseActions {
    issue: { key: string; id?: string } | { key?: string; id: string };
    projectKey?: string;
}

export interface InviteMemberActions extends BaseActions {
    issue: { key: string; typeName: string; projectKey: string };
    projectKey?: string;
}

export interface PostIssueUpdatesActions extends BaseActions {
    newStatusId?: string;
    oldKey: string;
    newKey: string;
    newNameData: { key: string; summary: string };
    changelog: object;
    author: string;
    projectKey?: string;
}

export interface PostEpicUpdatesActions extends BaseActions {
    epicKey: string;
    data: { epic: { key: string }; issue: { key: string; id: string }; status?: string };
}

export interface PostNewLinksActions extends BaseActions {
    links: string[];
}

export interface PostLinkedChangesActions extends BaseActions {
    linksKeys: string[];
    data: {
        status: string;
        key: string;
        summary: string;
        id: string;
        changelog: object;
        name: string;
    };
}

export interface DeletedLinksActions extends BaseActions {
    sourceIssueId: string;
    destinationIssueId: string;
    sourceRelation: string;
    destinationRelation: string;
}
