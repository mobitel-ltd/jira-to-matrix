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
    const indent = '&nbsp;&nbsp;&nbsp;&nbsp;';
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
}

const getTutorial = () => {
    const indent = '&nbsp;&nbsp;&nbsp;&nbsp;';

    const post = `
    <br>
    <h4>Tutorial for jira comands:</h4>
    <h5>Use "!comment" command to comment in jira issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!comment some text</strong></font><br>
        ${indent}text "<font color="green">some text</font>" will be shown in jira comments<br>
    <h5>Use "!assign" command to assign jira issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!assign mv_nosak</strong></font><br>
        ${indent}user '<font color="green">mv_nosak</font>' will become assignee for the issue<br><br>
        ${indent}<font color="green"><strong>!assign</strong></font><br>
        ${indent}you will become assignee for the issue
    <h5>Use "!move" command to view list of available transitions<br>
    example:</h5>
        ${indent}<font color="green"><strong>!move</strong></font><br>
        ${indent}you will see a list:<br>
        ${indent}${indent}1) Done<br>
        ${indent}${indent}2) On hold<br>
        ${indent}Use <font color="green"><strong>"!move done"</strong></font> or 
        <font color="green"><strong>"!move 1"</strong></font>
    <h5>Use "!spec" command to add watcher for issue<br>
    example:</h5>
        ${indent}<font color="green"><strong>!spec mv_nosak</strong></font><br>
        ${indent}user '<font color="green">mv_nosak</font>' added in watchers for the issue<br><br>
    `;
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
        
        // description
        await req.mclient.sendHtmlMessage(
            req.newRoomID,
            htmlToText(formatted),
            formatted.post
        );

        // tutorial jira commands
        await req.mclient.sendHtmlMessage(
            req.newRoomID,
            'Send tutorial', 
            getTutorial()
        );
    }
}

module.exports = middleware;
