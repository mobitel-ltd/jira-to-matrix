const path = require('path');
const validate = require('./validate-config.js');

const configPath = process.env.NODE_ENV === 'test' ? './test/fixtures/' : './';

const configFilepath = path.resolve(configPath, 'config.js');

const configData = require(configFilepath);

const composeConfig = config => {
    if (!validate(config)) {
        process.exit(1);
    }

    const messenger = {
        ...config.messenger,
        baseUrl: `https://${config.messenger.domain}`,
        userId: `@${config.messenger.user}:${config.messenger.domain}`,
    };

    config.features.epicUpdates.on = () => (
        config.features.epicUpdates.newIssuesInEpic === 'on'
        || config.features.epicUpdates.issuesStatusChanged === 'on'
    );

    return {...config, messenger};
};

module.exports = composeConfig(configData);
