const R = require('ramda');
const mconf = require('../config').matrix;

function membersInvited(roomMembers) {
    return R.pipe(
        R.filter(R.complement(R.propEq('membership', 'leave'))),
        R.values,
        R.map(R.prop('userId'))
    )(roomMembers);
}

function userID(shortName) {
    return `@${shortName}:${mconf.domain}`;
}

const composeRoomName = issue =>
    `${issue.key} ${R.path(['fields', 'summary'], issue)}`;

module.exports = {membersInvited, userID, composeRoomName};
