const utils = require('../lib/utils');
const {postStatusChanged} = require('./helper.js');

module.exports = async ({mclient, linksKeys, data}) => {
    try {
        const matrixRoomIds = await Promise.all(linksKeys.map(mclient.getRoomId));
        await Promise.all(matrixRoomIds.map(roomID =>
            postStatusChanged({mclient, roomID, data})));

        return true;
    } catch (err) {
        throw utils.errorTracing('postLinkedChanges', err);
    }
};
