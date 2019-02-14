const MatrixApi = require('matrix-sdk-fasade');

const messengers = {
    matrix: MatrixApi,
    // slack: SlackApi,
};

module.exports = type => messengers[type];
