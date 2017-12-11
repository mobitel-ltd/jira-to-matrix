const Ramda = require('ramda');
const {postChangesToLinks: conf} = require('../config').features;
const {postStatusChanged} = require('./helper.js');
const logger = require('../modules/log.js')(module);

const handleLink = async (body, link, mclient) => {
    const destIssue = Ramda.either(
        Ramda.prop('outwardIssue'),
        Ramda.prop('inwardIssue')
    )(link);
    if (!destIssue) {
        logger.debug('no destIssue in handleLink');
        return;
    }
    const destStatusCat = Ramda.path(['fields', 'status', 'statusCategory', 'id'], destIssue);
    if (conf.ignoreDestStatusCat.includes(destStatusCat)) {
        return;
    }
    const roomID = await mclient.getRoomId(destIssue.key);
    if (!roomID) {
        return;
    }
    postStatusChanged(roomID, body, mclient);
};

const postLinkedChanges = async ({mclient, links, data, status}) => {
    try {
        if (!links || links.length === 0 || typeof status !== 'string') {
            logger.debug('no links to change');
            return true;
        }
        await Promise.all(links.map(async link => {
            await handleLink(data, link, mclient);
        }));
    } catch (err) {
        logger.error('error in postLinkedChanges');
        throw err;
    }
};

module.exports = {postLinkedChanges};
