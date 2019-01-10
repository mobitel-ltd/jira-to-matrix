const {postStatusChanged} = require('./helper.js');

const handleLink = (data, mclient) => async roomID => {
    try {
        await postStatusChanged({mclient, roomID, data});
    } catch (err) {
        throw ['Error in handleLink in postLinkedChanges', err].join('\n');
    }
};

module.exports = async ({mclient, linksKeys, data}) => {
    try {
        const matrixRoomIds = await Promise.all(linksKeys.map(mclient.getRoomId));
        await Promise.all(matrixRoomIds.map(handleLink(data, mclient)));

        return true;
    } catch (err) {
        throw ['Error in postLinkedChanges', err].join('\n');
    }
};
