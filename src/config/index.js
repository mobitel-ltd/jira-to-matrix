const Ramda = require('ramda');
const path = require('path');
const validate = require('./validate-config.js');

const configPath = process.env.NODE_ENV === 'test' ? './test/fixtures/' : './';

const configFilepath = path.resolve(configPath, 'config.js');

const configData = require(configFilepath);

const composeConfig = config => {
    if (!validate(config)) {
        process.exit(1);
    }

    const matrix = {
        ...config.matrix,
        baseUrl: `https://${config.matrix.domain}`,
        userId: `@${config.matrix.user}:${config.matrix.domain}`,
    };

    const version = '2017-06-27';

    config.features.epicUpdates.on = () => (
        config.features.epicUpdates.newIssuesInEpic === 'on'
        || config.features.epicUpdates.issuesStatusChanged === 'on'
    );
    const result = Ramda.mergeAll([config, {matrix}, {version}]);

    return result;
};

const config = composeConfig(configData);
config.matrix.postfix = `:${config.matrix.domain}`.length;

module.exports = config;
