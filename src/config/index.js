const { resolve } = require('path');
const validate = require('./validate-config.js');

const configPath = process.env.NODE_ENV === 'test' ? './test/fixtures/' : './';

const configFilepath = resolve(configPath, 'config.js');

const configData = require(configFilepath);

const composeConfig = config => {
    if (!validate(config)) {
        process.exit(1);
    }
    const workerBot = { user: config.messenger.user, password: config.messenger.password };
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

        return { ...config, messenger, baseRemote, baseLink };
    }

    return { ...config, messenger };
};

module.exports = composeConfig(configData);
