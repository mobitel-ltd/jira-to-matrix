const conf = require('../config');
const {auth} = require('./common');
const {fetchJSON} = require('../utils');

/**
 * Make GET request to jira by ID to get linked issues
 * @param {string} id linked issue ID in jira
 * @return {object} jira response with issue
 */
const get = async id => {
    const body = await fetchJSON(
        `${conf.jira.url}/rest/api/2/issueLink/${id}`,
        auth()
    );

    return body;
};

module.exports = {get};
