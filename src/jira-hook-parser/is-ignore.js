const logger = require('../modules/log.js')(module);
const {getIgnoreInfo} = require('../bot/helper.js');

const getUserStatusMsg = ({username, creator, startEndUpdateStatus, ignoreStatus}) =>
    `User "${username}", creator "${creator}", startendmode "${startEndUpdateStatus}" ignore status: ${ignoreStatus}`;

const getProjectStatusMsg = ({webhookEvent, ignoreStatus, timestamp, issueName}) =>
    `Webhook ${webhookEvent}, timestamp ${timestamp}, issueName ${issueName}, ignored status: ${ignoreStatus}`;

module.exports = async body => {
    const {projectStatus, userStatus} = await getIgnoreInfo(body);
    const userStatusMsg = getUserStatusMsg(userStatus);
    const projectStatusMsg = getProjectStatusMsg(projectStatus);

    logger.info(userStatusMsg, '\n', projectStatusMsg);

    if (userStatus.ignoreStatus || projectStatus.ignoreStatus) {
        throw 'User ignored';
    }
};
