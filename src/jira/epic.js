const conf = require('../config');
const logger = require('../modules/log.js')(module);
const {auth} = require('./common');
const {fetchJSON, paramsToQueryString} = require('../utils');

const issuesIn = async epicKey => {
    const searchField = conf.features.epicUpdates.fieldAlias;
    const params = [
        {jql: `"${searchField}"=${epicKey}`},
        {fields: '""'},
        {maxResults: 500},
    ];
    const obj = await fetchJSON(
        `${conf.jira.url}/rest/api/2/search/${paramsToQueryString(params)}`,
        auth()
    );
    if (!(obj instanceof Object)) {
        logger.warn('Response from jira not object');
        return;
    }
    return obj.issues || [];
};

module.exports = {issuesIn};
