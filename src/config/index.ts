import { resolve } from 'path';
import { validate } from './validate-config';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types/index';
import proxyquire from 'proxyquire';

const defaultRepoName = 'git-repo';
const env = process.env.NODE_ENV || 'development';

const pathDict = {
    test: './test/fixtures/config.ts',
    development: './config.json',
    production: './config.json',
};

const configPath = pathDict[env];

const configFilepath = resolve(configPath);

const loadedConfig = proxyquire(configFilepath, {});
const configData = loadedConfig.config ? loadedConfig.config : loadedConfig;

const defaultConfigData = {
    delayInterval: 500,
    pathToDocs: 'https://github.com/mobitel-ltd/jira-to-matrix/tree/master/docs',
    ignoreCommands: [],
    maxFileSize: 10 * 1024 * 1024,
};

const composeConfig = (baseConfig: any): Config => {
    if (!validate(baseConfig)) {
        process.exit(1);
    }

    const config = { ...defaultConfigData, ...baseConfig };

    const workerBot = { user: config.messenger.user, password: config.messenger.password, isMaster: true };
    const historicBots = config.messenger.bots || [];
    // this helps not to use bot in list when we try to check if he is in the room
    const fileredHistoric = historicBots.filter(item => !(item.user === workerBot.user));
    const bots = [...fileredHistoric, workerBot];

    const messenger = {
        ...config.messenger,
        baseUrl: `https://${config.messenger.domain}`,
        bots,
    };

    config.features.epicUpdates.on = () =>
        config.features.epicUpdates.newIssuesInEpic === 'on' ||
        config.features.epicUpdates.issuesStatusChanged === 'on';

    if (config.gitArchive) {
        // http is for test only to send to local git server
        const protocol = config.gitArchive.protocol || 'https';
        const baseRemote = `${protocol}://${config.gitArchive.user}:${config.gitArchive.password}@${config.gitArchive.repoPrefix}`;
        const baseLink = `${protocol}://${config.gitArchive.repoPrefix}`;
        const baseTmpPath = config.gitArchive.baseDir || os.tmpdir();
        const repoDirName = config.gitArchive.gitReposName || defaultRepoName;
        const gitReposPath = path.resolve(baseTmpPath, repoDirName);
        const sshLink = `git@${config.gitArchive.repoPrefix.replace('/', ':')}`;
        if (!fs.existsSync(gitReposPath)) {
            fs.mkdirSync(gitReposPath);
        }

        return { ...config, messenger, baseRemote, baseLink, sshLink, gitReposPath };
    }

    return { ...config, messenger };
};

export const config: Config = composeConfig(configData);
