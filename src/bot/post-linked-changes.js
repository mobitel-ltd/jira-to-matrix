const {postStatusChanged} = require('./helper.js');
const logger = require('../modules/log.js')(module);

const handleLink = async (data, key, mclient) => {
    try {
        const roomID = await mclient.getRoomId(key);
        if (!roomID) {
            return;
        }
        logger.debug('roomID', roomID);
        await postStatusChanged({mclient, roomID, data});
    } catch (err) {
        logger.error('Error in handleLink in postLinkedChanges');

        throw err;
    }
};

module.exports = async ({mclient, linksKeys, data}) => {
    try {
        await Promise.all(linksKeys.map(async key => {
            await handleLink(data, key, mclient);
        }));

        return true;
    } catch (err) {
        logger.error('error in postLinkedChanges');
        throw err;
    }
};
