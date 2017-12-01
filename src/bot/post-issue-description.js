const lodash = require('lodash');
const htmlToText = require('html-to-text').fromString;
const jira = require('../jira');
const logger = require('debug')('bot post issue');
const translate = require('../locales');

const getTextIssue = (issue, address) => {
    const text = String(
        lodash.get(issue.fields, address) || translate('miss')
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
        const epic = await jira.issue.getFormatted(epicLink);
        let nameEpic;
        if (typeof epic === 'object' && epic.key === epicLink) {
            nameEpic = String(lodash.get(epic.renderedField, 'customfield_10005')
                || lodash.get(epic.fields, 'customfield_10005')
                || epicLink
            );
        }

        logger(`Epic name: ${nameEpic}; epic key: ${epicLink}`);

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

const getTutorial = () => `
    <br>
    Use <font color="green"><strong>!help</strong></font> in chat for give info for jira commands
    `;

const postIssueDescription = async ({mclient, issue, newRoomID}) => {
    const post = await getPost(issue);
    const formatted = Object.assign(
        {},
        {post},
        await jira.issue.renderedValues(issue.id, ['description'])
    );

    // description
    await mclient.sendHtmlMessage(
        newRoomID,
        htmlToText(formatted),
        formatted.post
    );

    // tutorial jira commands
    await mclient.sendHtmlMessage(
        newRoomID,
        'Send tutorial',
        getTutorial()
    );
};

module.exports = {postIssueDescription};
