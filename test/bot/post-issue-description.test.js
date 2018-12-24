const nock = require('nock');
const utils = require('../../src/lib/utils.js');
const JSONbody = require('../fixtures/webhooks/issue/created.json');
const {getCreateRoomData} = require('../../src/jira-hook-parser/parse-body.js');
const renderedIssueJSON = require('../fixtures/jira-api-requests/issue-rendered.json');
const postIssueDescription = require('../../src/bot/post-issue-description.js');
const htmlToText = require('html-to-text').fromString;

const chai = require('chai');
const {stub} = require('sinon');
const sinonChai = require('sinon-chai');
const {expect} = chai;
chai.use(sinonChai);

describe('Create room test', () => {
    const newRoomID = 'roomId';
    const createRoomData = getCreateRoomData(JSONbody);

    const epicKey = createRoomData.issue.descriptionFields.epicLink;
    const sendHtmlMessageStub = stub();
    const getRoomIdStub = stub().returns('id');
    const createRoomStub = stub().returns('correct room');

    const mclient = {
        sendHtmlMessage: sendHtmlMessageStub,
        getRoomId: getRoomIdStub,
        createRoom: createRoomStub,
    };


    const {descriptionFields} = createRoomData.issue;
    const {description} = renderedIssueJSON.renderedFields;
    const post = `
            Assignee:
                <br>${utils.INDENT}${descriptionFields.assigneeName}
                <br>${utils.INDENT}${descriptionFields.assigneeEmail}<br>
            <br>Reporter:
                <br>${utils.INDENT}${descriptionFields.reporterName}
                <br>${utils.INDENT}${descriptionFields.reporterEmail}<br>
            <br>Type:
                <br>${utils.INDENT}${descriptionFields.typeName}<br>
            <br>Estimate time:
                <br>${utils.INDENT}${descriptionFields.estimateTime}<br>
            <br>Description:
                <br>${utils.INDENT}${description}<br>
            <br>Priority:
                <br>${utils.INDENT}${descriptionFields.priority}<br>`;
    const epicInfo = `            <br>Epic link:
                <br>${utils.INDENT}${epicKey}
                <br>${utils.INDENT}${utils.getViewUrl(epicKey)}<br>`;
    const expectedHTMLBody = [post, epicInfo].join('\n');
    const expectedBody = htmlToText(expectedHTMLBody);

    before(() => {
        nock(utils.getRestUrl(), {
            reqheaders: {
                Authorization: utils.auth(),
            },
        })
            .get(`/issue/${createRoomData.issue.id}`)
            .query(utils.expandParams)
            .reply(200, renderedIssueJSON);
    });

    it('Description with epic should be created', async () => {
        await postIssueDescription({mclient, ...createRoomData, newRoomID});

        expect(sendHtmlMessageStub.firstCall.args).to.be.deep.equal([newRoomID, expectedBody, expectedHTMLBody]);
        expect(sendHtmlMessageStub.secondCall).to.have.been.calledWith(newRoomID, 'Send tutorial', utils.infoBody);
    });

    it('Description with error', async () => {
        let res;
        const expectedError = utils.getDefaultErrorLog('post issue description');
        try {
            res = await postIssueDescription({mclient, ...createRoomData, newRoomID});
        } catch (error) {
            res = error;
        }

        expect(res).to.include(expectedError);
    });
});
