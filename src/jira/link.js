const conf = require('../config');
const {auth} = require('./common');
const {fetchJSON} = require('../utils');

const get = async id => {
    const link = await fetchJSON(
        `${conf.jira.url}/rest/api/2/issueLink/${id}`,
        auth()
    );
    return link;
};

module.exports = {get};
