const {postStatusChanged} = require('./helper.js');

const handleLink = (data, mclient) => async key => {
    try {
        const roomID = await mclient.getRoomId(key);
        if (!roomID) {
            return;
        }

        await postStatusChanged({mclient, roomID, data});
    } catch (err) {
        throw ['Error in handleLink in postLinkedChanges', err].join('\n');
    }
};

module.exports = async ({mclient, linksKeys, data}) => {
    try {
        await Promise.all(linksKeys.map(handleLink(data, mclient)));

        return true;
    } catch (err) {
        throw ['Error in postLinkedChanges', err].join('\n');
    }
};
