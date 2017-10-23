const comment = require('./comment.js');
const assign = require('./assign.js');
const move = require('./move.js');
const spec = require('./spec.js');
const prio = require('./prio.js');
const op = require('./op.js');
const invite = require('./invite.js');
const help = require('./help.js');

module.exports = {
    '!comment': comment,
    '!assign': assign,
    '!move': move,
    '!spec': spec,
    '!prio': prio,
    '!op': op,
    '!invite': invite,
    '!help': help,
};
