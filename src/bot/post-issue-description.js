const Ramda = require('ramda');
const htmlToText = require('html-to-text').fromString;
const {getIssueFormatted, getRenderedValues} = require('../jira').issue;
const logger = require('../modules/log.js')(module);
const translate = require('../locales');

const getPost = async ({assigneeName,
    assigneeEmail,
    reporterName,
    reporterEmail,
    typeName,
    epicLink,
    estimateTime,
    description,
}) => {
    try {
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
    } catch (err) {
        logger.error('getPost error');

        throw err;
    }
};

const getTutorial = `
    <br>
    Use <font color="green"><strong>!help</strong></font> in chat for give info for jira commands
    `;

module.exports = async ({mclient, issue, newRoomID}) => {
    logger.debug('Post issue description start');
    try {
        const post = await getPost(issue.descriptionFields);
        logger.debug('post', post);
        const renderedValues = await getRenderedValues(issue.id, ['description']);
        const {post: htmlBody} = {post, ...renderedValues};
        const body = htmlToText(htmlBody);

        // description
        await mclient.sendHtmlMessage(newRoomID, body, htmlBody);

        // tutorial jira commands
        await mclient.sendHtmlMessage(newRoomID, 'Send tutorial', getTutorial);
    } catch (err) {
        logger.error('post issue description error');

        throw err;
    }
};
