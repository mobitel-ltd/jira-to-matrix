/* eslint-disable no-console */
import * as fs from 'fs';
import * as R from 'ramda';
import * as Joi from 'joi';

const int = Joi.number()
    .integer()
    .required();
const string = Joi.string().required();
const boolean = Joi.boolean().required();
const address = [string.uri(), string.ip()];
const obj = fields => Joi.object(fields).required();
const objOptional = fields => Joi.object(fields).optional();
const array = itemsType => Joi.array().items(itemsType);

const schema = obj({
    port: int,
    lang: ['en', 'ru'],
    pathToDocs: string.optional(),
    taskTracker: obj({
        type: ['jira', 'gitlab'],
        url: address,
        user: string,
        password: string,
        defaultLabel: objOptional({
            name: string,
            // description: string,
            // color: string,
        }),
    }),
    features: obj({
        // noIssueRooms: Joi.boolean().optional(),
        createRoom: boolean,
        createProjectRoom: Joi.boolean().optional(),
        inviteNewMembers: boolean,
        postComments: boolean,
        postIssueUpdates: boolean,
        postEachComments: Joi.boolean().optional(),
        postMilestoneUpdates: Joi.boolean().optional(),
        epicUpdates: obj({
            newIssuesInEpic: ['on', 'off'],
            issuesStatusChanged: ['on', 'off'],
            field: string,
            fieldAlias: string,
        }),
        newLinks: boolean,
        postChangesToLinks: obj({
            on: boolean,
            // Not to post to closed issues (3 - id of status category "Done")
            ignoreDestStatusCat: array(Joi.number().integer()),
        }),
    }),
    ignoreCommands: array(string).optional(),
    usersToIgnore: array(Joi.string()),
    inviteIgnoreUsers: array(Joi.string()),
    testMode: obj({
        on: boolean,
        users: array(Joi.string()),
    }),
    redis: obj({
        host: string,
        port: int,
        prefix: string,
    }),
    messenger: obj({
        name: ['matrix', 'slack'],
        admins: array(Joi.string()),
        domain: string,
        user: string,
        password: string,
        eventPort: Joi.number().optional(),
        bots: array(
            obj({
                user: string,
                password: string,
            }),
        ).optional(),
        infoRoom: objOptional({
            name: Joi.string()
                .alphanum()
                .uppercase(),
            users: array(Joi.string()).optional(),
        }),
    }),
    log: {
        type: string,
        filePath: string,
        fileLevel: string,
        consoleLevel: string,
    },
    ping: objOptional({
        interval: Joi.number()
            .integer()
            .optional(),
        count: Joi.number()
            .integer()
            .optional(),
    }),
    colors: objOptional({
        projects: Joi.alternatives(array(Joi.string()).optional(), 'all'),
    }),
    gitArchive: {
        user: string,
        password: string,
        repoPrefix: string,
        protocol: string.optional(),
        gitReposName: string.optional(),
        baseDir: string.optional(),
        options: objOptional({
            lastIssue: array(string).optional(),
        }),
    },
    delayInterval: int.optional(),
    maxFileSize: int.optional(),
});

/**
 * @param {object} config Config object for validation
 * @returns {boolean} TRUE if config valid, else FALSE
 */
export const validate = config => {
    const options = {
        abortEarly: false,
        convert: false,
    };
    const { error } = Joi.validate(config, schema, options);
    if (error) {
        console.error('Config is invalid:');
        error.details.forEach(detail => {
            console.error(`  - ${detail.path}: ${detail.message}`);
        });
        return false;
    }

    const baseTmpPath = R.path(['gitArchive', 'basePath'], config) as string;

    if (baseTmpPath) {
        if (!fs.existsSync(baseTmpPath)) {
            // eslint-disable-next-line no-console
            console.error(`${baseTmpPath} is not exists! Use existing path in your system.`);
            return false;
        }
    }

    return true;
};
