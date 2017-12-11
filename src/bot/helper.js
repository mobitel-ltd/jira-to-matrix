const Ramda = require('ramda');
const logger = require('../modules/log.js')(module);
const jira = require('../jira');
const translate = require('../locales');
const marked = require('marked');

const getNewStatus = Ramda.pipe(
    Ramda.pathOr([], ['changelog', 'items']),
    Ramda.filter(Ramda.propEq('field', 'status')),
    Ramda.head,
    Ramda.propOr(null, 'toString')
);

const postStatusChanged = async (roomID, issue, mclient) => {
    const status = getNewStatus(issue);
    logger.debug('status is ', status);
    if (typeof status !== 'string') {
        return;
    }
    const values = ['name', 'key', 'summary'].map(key => issue[key]);
    values['issue.ref'] = jira.issue.ref(issue.key);
    values.status = status;
    await mclient.sendHtmlMessage(
        roomID,
        translate('statusHasChanged', values),
        marked(translate('statusHasChangedMessage', values, values[name]))
    );
};

module.exports = {
    getNewStatus,
    postStatusChanged,
};
