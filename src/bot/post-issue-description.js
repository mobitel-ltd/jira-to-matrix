const Ramda = require('ramda');
const htmlToText = require('html-to-text').fromString;
const {issue: {getIssueFormatted, getRenderedValues}} = require('../jira');
const logger = require('../modules/log.js')(module);
const translate = require('../locales');

const getTextIssue = (issue, address) => {
    const text = String(
        Ramda.path(['fields', 'address'], issue) || translate('miss')
    ).trim();

    return text;
};

const getPost = async issue => {
    const assigneeName = getTextIssue(issue, 'assignee.displayName');
    const assigneeEmail = getTextIssue(issue, 'assignee.emailAddress');
    const reporterName = getTextIssue(issue, 'reporter.displayName');
    const reporterEmail = getTextIssue(issue, 'reporter.emailAddress');
    const typeName = getTextIssue(issue, 'issuetype.name');
    const epicLink = getTextIssue(issue, 'customfield_10006');
    const estimateTime = getTextIssue(issue, 'reporter.timeestimate');
    const description = getTextIssue(issue, 'description');
    const indent = '&nbsp;&nbsp;&nbsp;&nbsp;';
    let post;

    /* eslint-disable no-negated-condition */
    if (epicLink !== translate('miss')) {
        const epic = await getIssueFormatted(epicLink);
        let nameEpic;
        if (typeof epic === 'object' && epic.key === epicLink) {
            const renderedField = Ramda.path(['renderedField', 'customfield_10005'], epic);
            const fields = Ramda.path(['fields', 'customfield_10005'], epic);
            nameEpic = String(renderedField || fields || epicLink);
        }

        logger.info(`Epic name: ${nameEpic}; epic key: ${epicLink}`);

        post = `
            Assignee:
                <br>${indent}${assigneeName}
                <br>${indent}${assigneeEmail}<br>
            <br>Reporter:
                <br>${indent}${reporterName}
                <br>${indent}${reporterEmail}<br>
            <br>Type:
                <br>${indent}${typeName}<br>
            <br>Epic link:
                <br>${indent}${nameEpic} (${epicLink})
                <br>${indent}\thttps://jira.bingo-boom.ru/jira/browse/${epicLink}<br>
            <br>Estimate time:
                <br>${indent}${estimateTime}<br>
            <br>Description:
                <br>${indent}${description}<br>`;
    } else {
        post = `
            Assignee:
                <br>${indent}${assigneeName}
                <br>${indent}${assigneeEmail}<br>
            <br>Reporter:
                <br>${indent}${reporterName}
                <br>${indent}${reporterEmail}<br>
            <br>Type:
                <br>${indent}${typeName}<br>
            <br>Estimate time:
                <br>${indent}${estimateTime}<br>
            <br>Description:
                <br>${indent}${description}<br>`;
    }
    return post;
};

const getTutorial = `
    <br>
    Use <font color="green"><strong>!help</strong></font> in chat for give info for jira commands
    `;

module.exports = async ({mclient, issue, newRoomID}) => {
    try {
        const post = await getPost(issue);
        const renderedValues = await getRenderedValues(issue.id, ['description']);
        const formatted = {post, ...renderedValues};
        const htmlBody = htmlToText(formatted);

        // description
        await mclient.sendHtmlMessage(
            newRoomID,
            htmlBody,
            formatted.post
        );

        // tutorial jira commands
        await mclient.sendHtmlMessage(
            newRoomID,
            'Send tutorial',
            getTutorial
        );
    } catch (err) {
        logger.error('post issue discription error');

        throw err;
    }
};
