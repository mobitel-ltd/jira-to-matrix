const utils = require('../lib/utils');
const {getPostStatusData, isAvailabledIssue} = require('./helper.js');

const handler = (chatApi, data) => async key => {
    if (await isAvailabledIssue(key)) {
        const roomID = await chatApi.getRoomId(key);
        const {body, htmlBody} = getPostStatusData(data);
        return chatApi.sendHtmlMessage(roomID, body, htmlBody);
    }
};

module.exports = async ({chatApi, linksKeys, data}) => {
    try {
        await Promise.all(linksKeys.map(handler(chatApi, data)));

        return true;
    } catch (err) {
        throw utils.errorTracing('postLinkedChanges', err);
    }
};
