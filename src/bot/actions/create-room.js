const jiraRequest = require('../../lib/jira-request.js');
const utils = require('../../lib/utils.js');
const logger = require('../../modules/log.js')(module);
const {getDescription} = require('./helper');
const {infoBody} = require('../../lib/messages');

const createIssueRoom = async (chatApi, issue) => {
    try {
        const roomMembers = await jiraRequest.getIssueWatchers(issue);
        const invite = roomMembers.map(user => chatApi.getChatUserId(user));

        const {key, summary} = issue;
        const name = chatApi.composeRoomName(key, summary);
        const topic = utils.getViewUrl(key);

        const options = {
            'room_alias_name': key,
            invite,
            name,
            topic,
            'purpose': summary,
        };

        const roomId = await chatApi.createRoom(options);

        logger.info(`Created room for ${key}: ${roomId}`);
        const {body, htmlBody} = await getDescription(issue);

        await chatApi.sendHtmlMessage(roomId, body, htmlBody);
        await chatApi.sendHtmlMessage(roomId, infoBody, infoBody);
    } catch (err) {
        throw utils.errorTracing('createIssueRoom', err);
    }
};

const createProjectRoom = async (chatApi, projectKey) => {
    try {
        const {lead, name: projectName} = await jiraRequest.getProject(projectKey);
        const name = chatApi.composeRoomName(projectKey, projectName);
        const invite = [chatApi.getChatUserId(lead.key)];
        const topic = utils.getViewUrl(projectKey);

        const options = {
            'room_alias_name': projectKey,
            invite,
            name,
            topic,
        };

        const roomId = await chatApi.createRoom(options);
        logger.info(`Created room for project ${projectKey}: ${roomId}`);
    } catch (err) {
        throw utils.errorTracing('createProjectRoom', err);
    }
};

const getCheckedIssue = async issueData => {
    const issueBody = await jiraRequest.getIssueSafety(issueData.key || issueData.id);
    if (!issueBody) {
        return issueData;
    }

    return {
        ...issueData,
        key: utils.getKey(issueBody),
        roomMembers: utils.getMembers(issueBody),
        summary: utils.getSummary(issueBody),
    };
};

const hasData = issue => issue.key && issue.summary;

/**
 * post issue update
 * @param  {object} options options
 * @param  {object} options.chatApi messenger client instance
 * @param  {object} options.issue parsed webhook issue data
 * @param  {string} options.issue.id issue id
 * @param  {string?} options.issue.key issue key
 * @param  {string[]|undefined} options.issue.roomMembers issue roomMembers incudes author and assignee
 * @param  {string?} options.issue.summary issue summary
 * @param  {object} options.issue.descriptionFields issue descriptionFields
 * @param  {string} options.newKey new key of issue
 * @param  {string} options.newName new name of room
 * @param  {object} options.changelog changes object
 * @param  {string?} options.projectKey changes author
 */
module.exports = async ({chatApi, issue, projectKey}) => {
    try {
        const checkedIssue = hasData(issue) ? issue : await getCheckedIssue(issue);

        if (checkedIssue.key) {
            await chatApi.getRoomIdByName(checkedIssue.key) || await createIssueRoom(chatApi, checkedIssue);
        }
        if (projectKey) {
            await chatApi.getRoomIdByName(projectKey) || await createProjectRoom(chatApi, projectKey);
        }

        return true;
    } catch (err) {
        throw utils.errorTracing('create room', err);
    }
};
