const Ramda = require('ramda');
const mconf = require('../config').matrix;

const membersInvited = roomMembers =>
    Ramda.pipe(
        Ramda.filter(Ramda.complement(Ramda.propEq('membership', 'leave'))),
        Ramda.values,
        Ramda.map(Ramda.prop('userId'))
    )(roomMembers);

const userID = shortName => `@${shortName}:${mconf.domain}`;

const composeRoomName = issue =>
    `${issue.key} ${Ramda.path(['fields', 'summary'], issue)}`;

module.exports = {membersInvited, userID, composeRoomName};
