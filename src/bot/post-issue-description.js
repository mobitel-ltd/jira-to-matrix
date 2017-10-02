const _ = require('lodash');
const htmlToText = require('html-to-text').fromString;
const jira = require('../jira');
const logger = require('simple-color-logger')();
const {t} = require('../locales');

function getTextIssue(req, address) {
    const text = String(
        _.get(req.body.issue.fields, address) || t('miss')
    ).trim();

    return text;
}

async function getPost(req) {
    const assigneeName = getTextIssue(req, 'assignee.displayName');
    const assigneeEmail = getTextIssue(req, 'assignee.emailAddress');
    const reporterName = getTextIssue(req, 'reporter.displayName');
    const reporterEmail = getTextIssue(req, 'reporter.emailAddress');
    const typeName = getTextIssue(req, 'issuetype.name');
    const epicLink = getTextIssue(req, 'customfield_10006');
    const estimateTime = getTextIssue(req, 'reporter.timeestimate');
    const description = getTextIssue(req, 'description');
    let post;

    if (epicLink !== t('miss')) {
        const epic = await jira.issue.getFormatted(epicLink);
        let nameEpic;
        if (typeof epic === 'object' && epic.key === epicLink) {
            nameEpic = String(_.get(epic.renderedField, 'customfield_10005') 
                || _.get(epic.fields, 'customfield_10005') 
                || epicLink
            );
        }

        logger.info(`Epic name: ${nameEpic}; epic key: ${epicLink}`);

        post = `
            Assignee: 
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${assigneeName}
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${assigneeEmail}<br>
            <br>Reporter: 
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${reporterName}
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${reporterEmail}<br>
            <br>Type:
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${typeName}<br>
            <br>Epic link: 
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${nameEpic} (${epicLink})
                <br>&nbsp;&nbsp;&nbsp;&nbsp;\thttps://jira.bingo-boom.ru/jira/browse/${epicLink}<br>
            <br>Estimate time: 
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${estimateTime}<br>
            <br>Description: 
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${description}<br>`;
    } else {
        post = `
            Assignee: 
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${assigneeName}
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${assigneeEmail}<br>
            <br>Reporter: 
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${reporterName}
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${reporterEmail}<br>
            <br>Type:
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${typeName}<br>   
            <br>Estimate time: 
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${estimateTime}<br>
            <br>Description: 
                <br>&nbsp;&nbsp;&nbsp;&nbsp;${description}<br>`;
    }
    return post;
}

async function middleware(req) {
    if (req.newRoomID && req.mclient) {
        const post = await getPost(req);
        const {issue} = req.body;
        const formatted = Object.assign(
            {},
            {post},
            await jira.issue.renderedValues(issue.id, ['description'])
        );
        
        await req.mclient.sendHtmlMessage(
            req.newRoomID,
            htmlToText(formatted),
            formatted.post
        );
    }
}

module.exports = middleware;
