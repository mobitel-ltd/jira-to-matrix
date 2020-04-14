const comment = require('./comment');
const assign = require('./assign');
const move = require('./move');
const spec = require('./speci');
const prio = require('./prio');
const op = require('./op');
const invite = require('./invite');
const help = require('./help');
const ignore = require('./ignore');
const create = require('./create');
const autoinvite = require('./autoinvite');
const alive = require('./alive');
const getInfo = require('./getInfo');
const { kick } = require('./kick');
const { archive } = require('./archive');
const { projectarchive } = require('./archive-project');

module.exports = {
    comment,
    assign,
    move,
    spec,
    prio,
    op,
    invite,
    help,
    ignore,
    create,
    autoinvite,
    alive,
    getInfo,
    archive,
    projectarchive,
    kick,
};
