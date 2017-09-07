const conf = require('../config');
const {auth} = require('./common');
const {fetchJSON, paramsToQueryString} = require('../utils');

async function issuesIn(epicKey) {
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
        return undefined;
    }
    return obj.issues || [];
}

module.exports = {issuesIn};
