const SlackApi = require('./slack-api');
const MatrixApi = require('./matrix-api');

const messengers = {
    matrix: MatrixApi,
    slack: SlackApi,
};

module.exports = type => messengers[type];
