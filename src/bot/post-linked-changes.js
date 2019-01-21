const utils = require('../lib/utils');
const {postStatusChanged, isAvailabledIssue} = require('./helper.js');

const handler = (mclient, data) => async key => {
    if (await isAvailabledIssue(key)) {
        const roomID = await mclient.getRoomId(key);
        await postStatusChanged({mclient, roomID, data});
    }
};
module.exports = async ({mclient, linksKeys, data}) => {
    try {
        await Promise.all(linksKeys.map(handler(mclient, data)));

        return true;
    } catch (err) {
        throw utils.errorTracing('postLinkedChanges', err);
    }
};
