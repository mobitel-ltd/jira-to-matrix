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
    timestamp: number;
    webhookEvent: 'comment_created';
    comment: {
        self: string;
        id: string;
        author: UserData;
        body: string;
        updateAuthor: UserData;
        created: string;
        updated: string;
    };
}

export interface ChangelogItems {
    field: string;
    fieldtype: string;
    from: string | null;
    fromString: string;
    to: string | null;
    toString: string;
}

export interface Changelog {
    id: string;
    items: ChangelogItems[];
}
