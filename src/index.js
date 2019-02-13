const conf = require('./config');
const Matrix = require('matrix-sdk-fasade');
const service = require('./service');

service(Matrix, conf.matrix, conf.port);
