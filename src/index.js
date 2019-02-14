const conf = require('./config');
const getMessengerApi = require('./messengers');
const service = require('./service');

const MessengerApi = getMessengerApi(conf.messenger.name);

service(MessengerApi, conf.messenger, conf.port);
