const htmlToText = require('html-to-text').fromString;
const utils = require('../../src/lib/utils');
const {getRenderedValues} = require('../lib/jira-request.js');
const translate = require('../locales');

const getEpicInfo = epicLink =>
    ((epicLink === translate('miss'))
        ? ''
        : `            <br>Epic link:
                ${utils.getOpenedDescriptionBlock(epicLink)}
                ${utils.getClosedDescriptionBlock(utils.getViewUrl(epicLink))}`);

const getPost = description => {
    const post = `
            Assignee:
                ${utils.getOpenedDescriptionBlock(description.assigneeName)}
                ${utils.getClosedDescriptionBlock(description.assigneeEmail)}
            <br>Reporter:
                ${utils.getOpenedDescriptionBlock(description.reporterName)}
                ${utils.getClosedDescriptionBlock(description.reporterEmail)}
            <br>Type:
                ${utils.getClosedDescriptionBlock(description.typeName)}
            <br>Estimate time:
                ${utils.getClosedDescriptionBlock(description.estimateTime)}
            <br>Description:
                ${utils.getClosedDescriptionBlock(description.description)}
            <br>Priority:
                ${utils.getClosedDescriptionBlock(description.priority)}`;

    const epicInfo = getEpicInfo(description.epicLink);

    return [post, epicInfo].join('\n');
};


module.exports = async ({mclient, issue, newRoomID}) => {
    try {
        const {description} = await getRenderedValues(issue.id, ['description']);
        const htmlBody = await getPost({...issue.descriptionFields, description});
        const body = htmlToText(htmlBody);

        await mclient.sendHtmlMessage(newRoomID, body, htmlBody);

        await mclient.sendHtmlMessage(newRoomID, 'Send tutorial', utils.infoBody);
    } catch (err) {
        throw utils.errorTracing('post issue description', err);
    }
};
